import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { WebSocketServer, WebSocket } from 'ws';
import { Database } from '@agent-deck/bridge-database';
import { EventJournal, CommandLedger, ApprovalService, SnapshotService } from '@agent-deck/bridge-core';
import type { JournalEntry } from '@agent-deck/bridge-core';
import { FakeAdapter } from '@agent-deck/adapter-fake';
import type { FaultType } from '@agent-deck/adapter-fake';
import type { AdapterEvent } from '@agent-deck/adapter-contract';
import {
  asMessageId,
  asHostId,
  asSessionId,
  asCorrelationId,
  asTimestamp,
  type UcpEnvelope,
} from '@agent-deck/protocol';
import type { RunnerContext } from './runner.js';
import { assertConverged, assertReplayEqualsSnapshot, type ConvergeResult } from './convergence.js';

const __dirname = new URL('.', import.meta.url).pathname;
const MIGRATIONS_DIR = `${__dirname}/../../../db/migrations`;

const ADAPTER_TO_UCP_EVENT: Record<string, string> = {
  'session.started': 'session.created',
  'session.failed': 'session.failed',
  'session.cancelled': 'session.cancelled',
  'session.completed': 'session.completed',
};

function makeEnvelope(fields: {
  type: string;
  sessionId?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}): UcpEnvelope {
  const base: UcpEnvelope = {
    protocol: 'ucp',
    version: 1,
    messageId: asMessageId(randomUUID()),
    type: fields.type,
    timestamp: asTimestamp(new Date().toISOString()),
    hostId: asHostId('test-host'),
    payload: fields.payload,
  };
  if (fields.sessionId !== undefined) {
    (base as unknown as Record<string, unknown>)['sessionId'] = asSessionId(fields.sessionId);
  }
  if (fields.correlationId !== undefined) {
    (base as unknown as Record<string, unknown>)['correlationId'] = asCorrelationId(fields.correlationId);
  }
  return base;
}

const TEST_DEVICE_ID = 'test-device';

export class TestHarness implements RunnerContext {
  journal!: EventJournal;
  approvals!: ApprovalService;
  snapshot!: SnapshotService;
  ledger!: CommandLedger;

  private db!: Database;
  private adapter!: FakeAdapter;
  private wss!: WebSocketServer;
  private client: WebSocket | null = null;
  private hostId: string;
  private eventEmitter = new EventEmitter();
  private journalSeq = 0;
  private sessionId: string | null = null;
  private wsPort = 0;
  private runtimeToDbSession = new Map<string, string>();
  private clients = new Map<string, WebSocket>();
  private socketDeviceIds = new WeakMap<WebSocket, string>();

  constructor() {
    this.hostId = `host_${randomUUID().slice(0, 8)}`;
  }

  async setup(): Promise<void> {
    this.db = new Database(':memory:');
    await this.db.runMigrations(MIGRATIONS_DIR);
    this.insertTestDevice();

    this.journal = new EventJournal(this.db.db);
    this.ledger = new CommandLedger(this.db.db);
    this.approvals = new ApprovalService(this.db.db);
    this.snapshot = new SnapshotService(this.db.db);

    this.adapter = new FakeAdapter();
    this.adapter.on('session_event', (e: AdapterEvent) => this.onAdapterEvent(e));

    await this.startServer();
  }

  private insertTestDevice(): void {
    this.ensureDevice(TEST_DEVICE_ID);
  }

  private ensureDevice(deviceId: string): void {
    const now = new Date().toISOString();
    this.db.db.prepare(
      `INSERT OR IGNORE INTO devices (id, name, platform, public_key, grant_json, status, paired_at)
       VALUES (?, 'test-device', 'test', 'fake-pub-key', '{}', 'active', ?)`
    ).run(deviceId, now);
  }

  private async startServer(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: 0 }, () => {
        const addr = this.wss.address();
        if (addr && typeof addr === 'object') {
          this.wsPort = addr.port;
        }
        this.wss.on('connection', (ws) => this.onServerConnection(ws));
        resolve();
      });
    });
  }

  private onServerConnection(ws: WebSocket): void {
    ws.on('message', (data) => this.onServerMessage(ws, data));
  }

  private onServerMessage(ws: WebSocket, data: unknown): void {
    let msg: UcpEnvelope;
    try {
      msg = JSON.parse(String(data)) as UcpEnvelope;
    } catch {
      return;
    }

    if (msg.type === 'handshake/init') {
      const payload = msg.payload as Record<string, unknown> | undefined;
      const deviceId = typeof payload?.['deviceId'] === 'string' ? payload['deviceId'] : TEST_DEVICE_ID;
      this.ensureDevice(deviceId);
      this.socketDeviceIds.set(ws, deviceId);
      ws.send(JSON.stringify(makeEnvelope({
        type: 'handshake/ack',
        payload: { hostId: this.hostId, version: 1 },
      })));
      return;
    }

    if (msg.type === 'command/send') {
      this.onCommandSend(msg, ws);
      return;
    }

    if (msg.type === 'command/approve' || msg.type === 'command/reject') {
      this.onApprovalDecision(msg, ws);
      return;
    }

    if (msg.type === 'snapshot/get') {
      this.onSnapshotGet(msg, ws);
      return;
    }
  }

  private onCommandSend(msg: UcpEnvelope, ws: WebSocket): void {
    const payload = msg.payload as Record<string, unknown>;
    const idempotencyKey = payload['idempotencyKey'] as string;
    const sessionId = payload['sessionId'] as string | undefined;
    const deviceId = this.socketDeviceIds.get(ws) ?? TEST_DEVICE_ID;

    if (payload['kind'] === 'session.start') {
      const rid = randomUUID();
      const sid = sessionId ?? randomUUID();
      this.insertRuntimeInstance(rid);
      this.insertSession(sid, rid, `rt_${sid}`, payload);
      this.sessionId = sid;

      const acceptResult = this.ledger.accept({
        id: payload['commandId'] as string,
        idempotencyKey,
        deviceId,
        sessionId: this.sessionId,
        commandType: 'session.start',
        payloadHash: 'fake-hash',
      });

      const ackFields: { type: string; correlationId: string; payload: Record<string, unknown>; sessionId?: string } = {
        type: 'command/ack',
        correlationId: msg.messageId as unknown as string,
        payload: { result: acceptResult, commandId: payload['commandId'] },
      };
      if (this.sessionId) ackFields.sessionId = this.sessionId;
      ws.send(JSON.stringify(makeEnvelope(ackFields)));

      if (acceptResult === 'accepted') {
        this.adapter.startSession({}).then((runtimeSid) => {
          if (this.sessionId) {
            this.runtimeToDbSession.set(runtimeSid, this.sessionId);
            this.db.db.prepare(
              `UPDATE sessions SET runtime_session_id = ? WHERE id = ?`
            ).run(runtimeSid, this.sessionId);
          }
        }).catch(() => {});
      }
      return;
    }

    if (payload['kind'] === 'text') {
      const acceptResult = this.ledger.accept({
        id: payload['commandId'] as string,
        idempotencyKey,
        deviceId,
        sessionId: this.sessionId,
        commandType: 'session.send',
        payloadHash: 'fake-hash',
      });

      const ackFields: { type: string; correlationId: string; payload: Record<string, unknown>; sessionId?: string } = {
        type: 'command/ack',
        correlationId: msg.messageId as unknown as string,
        payload: { result: acceptResult, commandId: payload['commandId'] },
      };
      if (this.sessionId) ackFields.sessionId = this.sessionId;
      ws.send(JSON.stringify(makeEnvelope(ackFields)));

      if (acceptResult === 'accepted') {
        const rtSid = this.getRuntimeSessionId();
        if (rtSid) {
          this.adapter.sendInstruction(rtSid, payload['text'] as string, idempotencyKey).catch(() => {});
        }
      }
      return;
    }

    ws.send(JSON.stringify(makeEnvelope({
      type: 'command/ack',
      correlationId: msg.messageId as unknown as string,
      payload: { result: 'accepted', commandId: payload['commandId'] },
    })));
  }

  private onApprovalDecision(msg: UcpEnvelope, ws: WebSocket): void {
    const payload = msg.payload as Record<string, unknown>;
    const approvalId = payload['approvalId'] as string;
    const decision = msg.type === 'command/approve' ? 'approved' : 'rejected';
    const version = (payload['expectedApprovalVersion'] as number) ?? 1;
    const deviceId = this.socketDeviceIds.get(ws) ?? TEST_DEVICE_ID;
    const result = this.approvals.resolve(approvalId, decision, deviceId, version);

    ws.send(JSON.stringify(makeEnvelope({
      type: 'command/ack',
      correlationId: msg.messageId as unknown as string,
      payload: { result, approvalId, decision },
    })));

    if (result === 'resolved' && this.sessionId) {
      const seq = this.journal.append(this.sessionId, 'approval.resolved', {
        id: approvalId,
        state: decision,
        version: version + 1,
      });
      const entry: JournalEntry = { sequence: seq, eventId: '', sessionId: this.sessionId, type: 'approval.resolved', payload: { id: approvalId, state: decision, version: version + 1 }, createdAt: new Date().toISOString() };
      this.eventEmitter.emit('event:approval.resolved', entry);
      this.eventEmitter.emit('event:any', entry);

      const rtSid = this.getRuntimeSessionId();
      if (rtSid) {
        this.adapter.resolveApproval(rtSid, approvalId, decision, randomUUID()).catch(() => {});
      }
    }
  }

  private onSnapshotGet(msg: UcpEnvelope, ws: WebSocket): void {
    const payload = msg.payload as Record<string, unknown>;
    const sessionId = payload['sessionId'] as string;
    const snap = this.snapshot.getSessionSnapshot(sessionId);

    ws.send(JSON.stringify(makeEnvelope({
      type: 'snapshot/data',
      sessionId,
      correlationId: msg.messageId as unknown as string,
      payload: snap as unknown as Record<string, unknown>,
    })));
  }

  private onAdapterEvent(e: AdapterEvent): void {
    if (e.type === 'DISCONNECT' || e.type === 'RECONNECT') return;

    const dbSessionId = this.runtimeToDbSession.get(e.sessionId) ?? this.sessionId;
    const ucpType = ADAPTER_TO_UCP_EVENT[e.type] ?? e.type;

    if (ucpType === 'session.created' || e.type === 'session.started') {
      if (dbSessionId) {
        this.ensureSession(dbSessionId, e.payload);
      }
    }

    if (ucpType === 'session.completed' || e.type === 'session.failed') {
      if (dbSessionId) {
        const p = e.payload as Record<string, unknown>;
        const newState = e.type === 'session.failed' ? 'failed' : 'completed';
        const summary = (p['summary'] as string) ?? '';
        this.db.db.prepare(
          `UPDATE sessions SET state = ?, summary = ?, updated_at = ? WHERE id = ?`
        ).run(newState, summary, new Date().toISOString(), dbSessionId);
      }
    }

    if (ucpType === 'approval.requested' && dbSessionId) {
      this.createApproval(dbSessionId, e.payload as Record<string, unknown>);
    }

    const seq = this.journal.append(dbSessionId, ucpType, e.payload);
    this.journalSeq = seq;

    const entry: JournalEntry = { sequence: seq, eventId: '', sessionId: dbSessionId, type: ucpType, payload: e.payload, createdAt: e.timestamp };
    this.eventEmitter.emit(`event:${ucpType}:${dbSessionId}`, entry);
    this.eventEmitter.emit(`event:${ucpType}`, entry);
    this.eventEmitter.emit('event:any', entry);
  }

  private ensureSession(sessionId: string, payload: unknown): void {
    const p = payload as Record<string, unknown>;
    const exists = this.db.db.prepare(
      `SELECT id FROM sessions WHERE id = ?`
    ).get(sessionId);
    if (exists) return;

    const rid = randomUUID();
    this.insertRuntimeInstance(rid);
    const title = (p['title'] as string) ?? 'Untitled';
    const state = (p['state'] as string) ?? 'running';
    const summary = (p['summary'] as string) ?? '';
    const now = new Date().toISOString();
    this.db.db.prepare(
      `INSERT OR IGNORE INTO sessions (id, runtime_instance_id, runtime_session_id, title, state, summary, pending_approval_count, pending_question_count, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`
    ).run(sessionId, rid, `rt_${sessionId}`, title, state, summary, now, now);
  }

  private createApproval(sessionId: string, payload: Record<string, unknown>): void {
    const approvalId = (payload['id'] as string) ?? (payload['approvalId'] as string) ?? randomUUID();
    const category = (payload['category'] as string) ?? 'command';
    const risk = (payload['risk'] as string) ?? 'low';
    const reversible = (payload['reversible'] as string) ?? 'yes';
    const title = (payload['title'] as string) ?? '';
    const summary = (payload['summary'] as string) ?? '';
    const decisions = payload['decisions'] ?? ['approve', 'reject'];

    this.approvals.create({
      id: approvalId,
      sessionId,
      runtimeApprovalId: approvalId,
      category,
      risk,
      reversible,
      title,
      summary,
      decisions,
    });
  }

  private insertRuntimeInstance(id: string): void {
    const now = new Date().toISOString();
    this.db.db.prepare(
      `INSERT OR IGNORE INTO runtime_instances (id, runtime, mode, state, capabilities_json, created_at, updated_at)
       VALUES (?, 'codex', 'attached', 'ready', '{}', ?, ?)`
    ).run(id, now, now);
  }

  private insertSession(id: string, runtimeInstanceId: string, runtimeSessionId: string, payload: Record<string, unknown>): void {
    const now = new Date().toISOString();
    const title = (payload['title'] as string) ?? 'Untitled';
    const state = (payload['state'] as string) ?? 'running';
    const summary = (payload['summary'] as string) ?? '';
    this.db.db.prepare(
      `INSERT OR IGNORE INTO sessions (id, runtime_instance_id, runtime_session_id, title, state, summary, pending_approval_count, pending_question_count, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`
    ).run(id, runtimeInstanceId, runtimeSessionId, title, state, summary, now, now);
  }

  private getRuntimeSessionId(): string | null {
    if (!this.sessionId) return null;
    const row = this.db.db.prepare(
      `SELECT runtime_session_id FROM sessions WHERE id = ?`
    ).get(this.sessionId) as { runtime_session_id: string } | undefined;
    return row?.runtime_session_id ?? null;
  }

  async connect(deviceId = TEST_DEVICE_ID): Promise<void> {
    this.ensureDevice(deviceId);
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${this.wsPort}`);
      this.clients.set(deviceId, ws);
      if (deviceId === TEST_DEVICE_ID) {
        this.client = ws;
      }
      ws.on('open', () => {
        ws.send(JSON.stringify(makeEnvelope({
          type: 'handshake/init',
          payload: { version: 1, deviceId },
        })));
        const onMsg = (data: unknown) => {
          try {
            const msg = JSON.parse(String(data)) as UcpEnvelope;
            if (msg.type === 'handshake/ack') {
              ws.removeListener('message', onMsg);
              resolve();
            }
          } catch (err) {
            ws.removeListener('message', onMsg);
            reject(err);
          }
        };
        ws.on('message', onMsg);
      });
      ws.on('close', () => {
        if (this.clients.get(deviceId) === ws) {
          this.clients.delete(deviceId);
        }
        if (this.client === ws) {
          this.client = null;
        }
      });
      ws.on('error', reject);
    });
  }

  async disconnect(deviceId = TEST_DEVICE_ID): Promise<void> {
    const client = this.clients.get(deviceId);
    if (client) {
      client.close();
      this.clients.delete(deviceId);
      if (deviceId === TEST_DEVICE_ID && this.client === client) {
        this.client = null;
      }
    }
  }

  async reconnect(deviceId = TEST_DEVICE_ID): Promise<void> {
    await this.connect(deviceId);
    if (this.sessionId) {
      const snap = this.snapshot.getSessionSnapshot(this.sessionId);
      if (snap.session) {
        this.eventEmitter.emit('snapshot:restored', snap);
      }
    }
  }

  async startAdapterSession(): Promise<string> {
    const rid = randomUUID();
    this.insertRuntimeInstance(rid);
    const runtimeSid = await this.adapter.startSession({});
    const dbSid = randomUUID();
    this.runtimeToDbSession.set(runtimeSid, dbSid);
    this.insertSession(dbSid, rid, runtimeSid, { title: 'Auto-started', state: 'running', summary: '' });
    this.sessionId = dbSid;
    return dbSid; // Return DB session ID for use with waitForEvent
  }

  async sendCommand(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.sendCommandAsDevice(TEST_DEVICE_ID, payload);
  }

  async sendCommandAsDevice(deviceId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const client = this.clients.get(deviceId);
    if (!client || client.readyState !== WebSocket.OPEN) {
      throw new Error('Client not connected');
    }

    const commandId = (payload['commandId'] as string) ?? randomUUID();
    const idempotencyKey = (payload['idempotencyKey'] as string) ?? randomUUID();
    const msgId = randomUUID();

    const kind = payload['kind'] as string | undefined;
    let msgType = 'command/send';
    if (kind === 'command/approve' || kind === 'command/reject') {
      msgType = kind;
    }

    const envelopePayload: Record<string, unknown> = {
      commandId,
      idempotencyKey,
      ...payload,
    };

    const envelope: Record<string, unknown> = {
      protocol: 'ucp',
      version: 1,
      messageId: msgId,
      type: msgType,
      timestamp: new Date().toISOString(),
      hostId: 'test-host',
      payload: envelopePayload,
    };
    if (this.sessionId) envelope['sessionId'] = this.sessionId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.removeListener('message', handler);
        reject(new Error('Command ack timeout'));
      }, 3000);
      const handler = (data: unknown) => {
        try {
          const msg = JSON.parse(String(data)) as Record<string, unknown>;
          if (msg['type'] === 'command/ack' && msg['correlationId'] === msgId) {
            clearTimeout(timeout);
            client.removeListener('message', handler);
            resolve(msg['payload'] as Record<string, unknown>);
          }
        } catch {}
      };
      client.on('message', handler);
      client.send(JSON.stringify(envelope));
    });
  }

  async waitForEvent(type: string, sessionId: string, timeoutMs = 5000): Promise<JournalEntry> {
    return this.waitForEventAfterSequence(type, sessionId, 0, timeoutMs);
  }

  async waitForEventAfterSequence(
    type: string,
    sessionId: string,
    afterSequence: number,
    timeoutMs = 5000
  ): Promise<JournalEntry> {
    if (sessionId) {
      const existing = this.journal.getAfter(sessionId, afterSequence).find((e) => e.type === type);
      if (existing) return existing;
    } else {
      const allSessions = this.db.db.prepare(
        `SELECT DISTINCT session_id FROM event_journal WHERE session_id IS NOT NULL`
      ).all() as { session_id: string }[];
      for (const row of allSessions) {
        const existing = this.journal.getAfter(row.session_id, afterSequence).find((e) => e.type === type);
        if (existing) return existing;
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.eventEmitter.removeListener('event:any', handler);
        reject(new Error(`Timeout waiting for event '${type}' on session '${sessionId ?? '*'}' after seq ${afterSequence}`));
      }, timeoutMs);

      const handler = (e: JournalEntry) => {
        if (e.type === type && e.sequence > afterSequence) {
          if (!sessionId || e.sessionId === sessionId) {
            clearTimeout(timeout);
            this.eventEmitter.removeListener('event:any', handler);
            resolve(e);
          }
        }
      };
      this.eventEmitter.on('event:any', handler);
    });
  }

  async teardown(): Promise<void> {
    await this.adapter.dispose();
    for (const client of this.clients.values()) {
      client.close();
    }
    this.clients.clear();
    this.client = null;
    if (this.wss) {
      for (const ws of this.wss.clients) {
        ws.close();
      }
      await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    }
    if (this.db) {
      this.db.close();
    }
    this.eventEmitter.removeAllListeners();
  }

  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  getAllPendingApprovals(): Array<{ id: string; sessionId: string; version: number }> {
    const allSessions = this.db.db.prepare(
      `SELECT id FROM approvals WHERE state = 'pending'`
    ).all() as { id: string }[];
    return allSessions.map((row) => {
      const approval = this.approvals.get(row.id)!;
      return { id: approval.id, sessionId: approval.sessionId, version: approval.version };
    });
  }

  // --- Fault injection API ---

  injectFault(type: FaultType): void {
    this.adapter.injectFault(type);
  }

  clearFaults(): void {
    this.adapter.clearFaults();
  }

  setApprovalRace(enabled: boolean): void {
    this.adapter.setApprovalRace(enabled);
  }

  setNetworkPartition(enabled: boolean): void {
    this.adapter.setNetworkPartition(enabled);
  }

  setSlowResponse(enabled: boolean): void {
    this.adapter.setSlowResponse(enabled);
  }

  simulateDeviceCount(_n: number): void {
    // Device simulation is exercised through connect(deviceId)/sendCommandAsDevice(deviceId).
  }

  captureState(): { session: unknown; approvals: unknown[]; journal: JournalEntry[] } {
    const sessionId = this.sessionId;
    if (!sessionId) return { session: null, approvals: [], journal: [] };
    const snap = this.snapshot.getSessionSnapshot(sessionId);
    const journal = this.journal.getAfter(sessionId, 0, 10000);
    return { session: snap.session, approvals: snap.pendingApprovals, journal };
  }

  assertConverged(runtimeState: Record<string, unknown>, normalizedState: Record<string, unknown>): ConvergeResult {
    return assertConverged(runtimeState, normalizedState);
  }

  assertReplayEqualsSnapshot(sessionId?: string): { equal: boolean; replayEvents: number; snapshotSession: unknown } {
    const sid = sessionId ?? this.sessionId;
    if (!sid) throw new Error('No session ID');
    const result = assertReplayEqualsSnapshot(this.journal, this.snapshot, sid);
    return { equal: result.equal, replayEvents: result.replayEvents, snapshotSession: result.snapshotSession };
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getAdapter(): FakeAdapter {
    return this.adapter;
  }

  getConnectedDeviceIds(): string[] {
    return [...this.clients.keys()];
  }
}
