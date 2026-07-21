import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';
import type { UcpEnvelope, HostId, MessageId, Timestamp } from '@agent-deck/protocol';
import { asMessageId, asHostId, asTimestamp } from '@agent-deck/protocol';
import { UcpEnvelopeSchema } from '@agent-deck/protocol';
import type { CommandLedger, SnapshotService, EventJournal } from '@agent-deck/bridge-core';
import type { RuntimeAdapter } from '@agent-deck/adapter-contract';
import {
  deriveSessionKey,
  decryptFrame,
  encryptFrame,
  type EncryptedFrame,
} from '@agent-deck/crypto';

export interface UcpGatewayConfig {
  port: number;
  host?: string;
  hostId: HostId;
  hostName?: string;
  hostPublicKey?: string;
  hostPrivateKey?: string;
  commandLedger: CommandLedger;
  resolveAdapter: (sessionId: string) => RuntimeAdapter | undefined;
  registerSession?: (sessionId: string) => void;
  snapshots: SnapshotService;
  journal: EventJournal;
  db: BetterSqlite3.Database;
  /** Validate a device public key. Returns device grant if valid, null otherwise. When omitted, auth is skipped. */
  validateDevice?: (devicePublicKey: string) => { deviceId: string; devicePublicKey: string; deviceName: string } | null;
  completePairing?: (
    devicePublicKey: string,
    deviceName: string,
    pairingNonce: string,
  ) => { deviceId: string; devicePublicKey: string; deviceName: string } | null;
  isDeviceRevoked?: (devicePublicKey: string) => boolean;
  allowInsecureLegacyMode?: boolean;
}

interface AuthenticatedClient {
  ws: WebSocket;
  deviceId: string;
  devicePublicKey: string;
  sessionKeyBase64: string;
  nextSendSequence: number;
  lastReceivedSequence: number;
}

const HANDSHAKE_TIMEOUT_MS = 30_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const MAX_JSON_FRAME_BYTES = 1024 * 1024;
const MAX_BINARY_FRAME_BYTES = 64 * 1024;

export class UcpGateway {
  private wss: WebSocketServer | null = null;
  private readonly authenticated = new Set<AuthenticatedClient>();
  private readonly authenticatedByDeviceKey = new Map<string, Set<AuthenticatedClient>>();
  private readonly unauthenticated = new Set<WebSocket>();
  private readonly config: UcpGatewayConfig;
  // ponytail: simple IP-based rate limiting with a Map — production would use a token bucket
  private readonly connectionAttempts = new Map<string, number[]>();
  port = 0;
  host = '';

  constructor(config: UcpGatewayConfig) {
    this.config = config;
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.config.port, host: this.config.host }, () => {
        const addr = this.wss!.address();
        if (typeof addr === 'object' && addr) {
          this.port = addr.port;
          this.host = addr.address;
        } else {
          this.port = this.config.port;
          this.host = this.config.host ?? '';
        }
        resolve(this.port);
      });
      this.wss.on('error', reject);
      this.wss.on('connection', (ws) => this.onConnection(ws));
    });
  }

  broadcast(envelope: UcpEnvelope): void {
    for (const client of this.authenticated) {
      this.sendEncrypted(client, envelope);
    }
    for (const ws of this.unauthenticated) {
      this.sendPlaintext(ws, envelope);
    }
  }

  sendToClient(ws: WebSocket, envelope: UcpEnvelope): void {
    const authenticatedClient = this.getAuthenticatedClient(ws);
    if (authenticatedClient) {
      this.sendEncrypted(authenticatedClient, envelope);
      return;
    }

    this.sendPlaintext(ws, envelope);
  }

  /** Send an encrypted frame to an authenticated client. */
  sendEncrypted(client: AuthenticatedClient, envelope: UcpEnvelope): void {
    if (client.ws.readyState !== WebSocket.OPEN) return;
    client.nextSendSequence += 1;
    const frame = encryptFrame(
      envelope as unknown as Record<string, unknown>,
      client.sessionKeyBase64,
      client.nextSendSequence,
    );
    client.ws.send(JSON.stringify(frame));
  }

  disconnectDevice(devicePublicKey: string, reason = 'Device revoked'): void {
    const clients = this.authenticatedByDeviceKey.get(devicePublicKey);
    if (!clients) return;
    for (const client of clients) {
      client.ws.close(4005, reason);
    }
  }

  stop(): void {
    for (const client of this.authenticated) {
      client.ws.close();
    }
    for (const ws of this.unauthenticated) {
      ws.close();
    }
    this.authenticated.clear();
    this.unauthenticated.clear();
    this.wss?.close();
    this.wss = null;
  }

  private getClientIp(ws: WebSocket): string {
    // ponytail: ws types don't expose socket.remoteAddress; cast for rate limiting
    const s = (ws as any).socket;
    const addr = (s?.remoteAddress as string) ?? 'unknown';
    return addr.replace(/^::ffff:/, '');
  }

  private isRateLimited(ip: string): boolean {
    const now = Date.now();
    const attempts = this.connectionAttempts.get(ip) ?? [];
    const recent = attempts.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    this.connectionAttempts.set(ip, recent);
    if (recent.length >= RATE_LIMIT_MAX) return true;
    recent.push(now);
    return false;
  }

  private onConnection(ws: WebSocket): void {
    const ip = this.getClientIp(ws);
    if (this.isRateLimited(ip)) {
      ws.close(1013, 'Rate limit exceeded');
      return;
    }

    const authRequired = this.config.validateDevice && this.config.hostPrivateKey && this.config.hostPublicKey;

    if (!authRequired && this.config.allowInsecureLegacyMode) {
      // No auth required — legacy mode
      this.handleLegacyConnection(ws);
      return;
    }
    if (!authRequired) {
      ws.close(1011, 'Bridge authentication not configured');
      return;
    }

    let handshakeTimer: ReturnType<typeof setTimeout> | null = null;
    let authenticatedClient: AuthenticatedClient | null = null;

    const cleanup = () => {
      if (handshakeTimer) clearTimeout(handshakeTimer);
      if (authenticatedClient) {
        this.authenticated.delete(authenticatedClient);
        const clients = this.authenticatedByDeviceKey.get(authenticatedClient.devicePublicKey);
        if (clients) {
          clients.delete(authenticatedClient);
          if (clients.size === 0) {
            this.authenticatedByDeviceKey.delete(authenticatedClient.devicePublicKey);
          }
        }
      }
    };

    // Start handshake timeout
    handshakeTimer = setTimeout(() => {
      if (!authenticatedClient) {
        ws.close(4001, 'Handshake timeout');
      }
    }, HANDSHAKE_TIMEOUT_MS);

    ws.on('message', (raw) => {
      if (this.isOversizedMessage(raw)) {
        ws.close(1009, 'Frame too large');
        cleanup();
        return;
      }

      let msg: unknown;
      try {
        msg = JSON.parse(this.messageToString(raw));
      } catch {
        if (!authenticatedClient) {
          ws.close(4006, 'Invalid handshake payload');
          cleanup();
        }
        return;
      }

      // Phase 1: wait for connection.initialize with device public key
      if (!authenticatedClient) {
        if (this.isInitializeMessage(msg)) {
          const payload = (msg as Record<string, unknown>).payload as Record<string, unknown> | undefined;
          const devicePublicKey = payload?.devicePublicKey as string | undefined;
          const deviceName = (payload?.deviceName as string) ?? 'Unknown Device';
          const pairingNonce = payload?.pairingNonce as string | undefined;
          const lastSyncSequence = Number(payload?.lastSyncSequence ?? 0);

          if (!devicePublicKey || !this.config.validateDevice || !this.config.hostPrivateKey || !this.config.hostPublicKey) {
            ws.close(4002, 'Missing devicePublicKey');
            cleanup();
            return;
          }

          if (this.config.isDeviceRevoked?.(devicePublicKey)) {
            ws.close(4005, 'Device revoked');
            cleanup();
            return;
          }

          let grant = this.config.validateDevice(devicePublicKey);
          if (!grant && pairingNonce && this.config.completePairing) {
            try {
              grant = this.config.completePairing(devicePublicKey, deviceName, pairingNonce) ?? null;
            } catch (error) {
              ws.close(4007, String(error));
              cleanup();
              return;
            }
          }
          if (!grant) {
            ws.close(4003, 'Device not paired');
            cleanup();
            return;
          }

          // Derive session key from host private + device public
          const { sessionKeyBase64 } = deriveSessionKey(
            this.config.hostPrivateKey,
            devicePublicKey,
          );

          authenticatedClient = {
            ws,
            deviceId: grant.deviceId,
            devicePublicKey,
            sessionKeyBase64,
            nextSendSequence: 0,
            lastReceivedSequence: 0,
          };
          this.authenticated.add(authenticatedClient);
          const clients = this.authenticatedByDeviceKey.get(devicePublicKey) ?? new Set<AuthenticatedClient>();
          clients.add(authenticatedClient);
          this.authenticatedByDeviceKey.set(devicePublicKey, clients);

          if (handshakeTimer) {
            clearTimeout(handshakeTimer);
            handshakeTimer = null;
          }

          // Send connection.initialized
          const envelope = this.buildEnvelope('connection.initialized', {
            hostId: this.config.hostId,
            hostName: this.config.hostName ?? '',
          }, undefined);
          this.sendEncrypted(authenticatedClient, envelope);
          this.sendSnapshot(authenticatedClient);
          this.replayEvents(authenticatedClient, lastSyncSequence);
        } else {
          ws.close(4008, 'Handshake required');
          cleanup();
        }
        return;
      }

      // Phase 2: decrypt and handle authenticated messages
      try {
        const frame = msg as EncryptedFrame;
        if (frame.encrypted && typeof frame.ciphertext === 'string') {
          if (!Number.isInteger(frame.sequence) || frame.sequence <= authenticatedClient.lastReceivedSequence) {
            ws.close(4009, 'Replay detected');
            cleanup();
            return;
          }
          const decrypted = decryptFrame(frame, authenticatedClient.sessionKeyBase64);
          authenticatedClient.lastReceivedSequence = frame.sequence;
          this.handleMessage(authenticatedClient, decrypted);
        } else {
          ws.close(4010, 'Encrypted frame required');
          cleanup();
        }
      } catch {
        // Tampered or invalid frame — close connection
        ws.close(4004, 'Invalid encrypted frame');
        cleanup();
      }
    });

    ws.on('close', () => {
      cleanup();
    });
  }

  private getAuthenticatedClient(ws: WebSocket): AuthenticatedClient | undefined {
    for (const client of this.authenticated) {
      if (client.ws === ws) {
        return client;
      }
    }

    return undefined;
  }

  private sendPlaintext(ws: WebSocket, envelope: UcpEnvelope): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(envelope));
    }
  }

  /** Legacy connection handling without encryption — for backward compatibility and tests. */
  private handleLegacyConnection(ws: WebSocket): void {
    let initialized = false;
    let lastSyncSequence = 0;

    ws.on('message', (raw) => {
      if (this.isOversizedMessage(raw)) {
        ws.close(1009, 'Frame too large');
        return;
      }
      let msg: unknown;
      try {
        msg = JSON.parse(this.messageToString(raw));
      } catch {
        return;
      }

      if (!initialized) {
        if (this.isInitializeMessage(msg)) {
          initialized = true;
          this.unauthenticated.add(ws);
          const payload = (msg as Record<string, unknown>).payload as Record<string, unknown> | undefined;
          lastSyncSequence = Number(payload?.lastSyncSequence ?? 0);
          this.sendToClient(ws, this.buildEnvelope('connection.initialized', { hostId: this.config.hostId }, undefined));
          this.sendSnapshotLegacy(ws);
          this.replayEventsLegacy(ws, lastSyncSequence);
        }
        return;
      }

      this.handleMessageLegacy(ws, msg);
    });

    ws.on('close', () => {
      this.unauthenticated.delete(ws);
    });
  }

  private replayEvents(client: AuthenticatedClient, afterSequence: number): void {
    if (afterSequence <= 0) return;
    const rows = this.getEventRows(afterSequence);
    for (const row of rows) {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      const envelope = this.buildEnvelope(row.type, payload, undefined, row.sequence);
      if (row.session_id) {
        (envelope as { sessionId?: string }).sessionId = row.session_id;
      }
      this.sendEncrypted(client, envelope);
    }
  }

  private replayEventsLegacy(ws: WebSocket, afterSequence: number): void {
    if (afterSequence <= 0) return;
    const rows = this.getEventRows(afterSequence);
    for (const row of rows) {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      const envelope = this.buildEnvelope(row.type, payload, undefined, row.sequence);
      if (row.session_id) {
        (envelope as { sessionId?: string }).sessionId = row.session_id;
      }
      this.sendToClient(ws, envelope);
    }
  }

  private getEventRows(afterSequence: number) {
    return this.config.db
      .prepare(
        `SELECT sequence, session_id, type, payload_json, created_at
         FROM event_journal
         WHERE sequence > @afterSequence
         ORDER BY sequence ASC
         LIMIT 500`
      )
      .all({ afterSequence }) as Array<{
        sequence: number;
        session_id: string | null;
        type: string;
        payload_json: string;
        created_at: string;
      }>;
  }

  private sendSnapshot(client: AuthenticatedClient): void {
    const snapshotEnvelope = this.buildSnapshotEnvelope();
    this.sendEncrypted(client, snapshotEnvelope);
  }

  private sendSnapshotLegacy(ws: WebSocket): void {
    const snapshotEnvelope = this.buildSnapshotEnvelope();
    this.sendToClient(ws, snapshotEnvelope);
  }

  private buildSnapshotEnvelope(): UcpEnvelope {
    const sessions = this.config.db
      .prepare(
        `SELECT id, runtime_instance_id, runtime_session_id, title, project_name,
                state, summary, current_action, pending_approval_count,
                pending_question_count, version, created_at, updated_at
         FROM sessions
         WHERE state NOT IN ('completed', 'failed', 'cancelled')
         ORDER BY updated_at DESC`
      )
      .all() as Array<{
        id: string;
        runtime_instance_id: string;
        runtime_session_id: string;
        title: string;
        project_name: string | null;
        state: string;
        summary: string;
        current_action: string | null;
        pending_approval_count: number;
        pending_question_count: number;
        version: number;
        created_at: string;
        updated_at: string;
      }>;

    const sessionPayloads = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      state: s.state,
      summary: s.summary,
      currentAction: s.current_action,
      pendingApprovalCount: s.pending_approval_count,
      pendingQuestionCount: s.pending_question_count,
      capabilities: {},
      version: s.version,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    const approvals = this.config.db
      .prepare(
        `SELECT id, session_id, runtime_approval_id, category, state, version,
                risk, reversible, title, summary, details_json, decisions_json, expires_at
         FROM approvals
         WHERE state = 'pending'
         ORDER BY created_at ASC`
      )
      .all() as Array<{
        id: string;
        session_id: string;
        runtime_approval_id: string;
        category: string;
        state: string;
        version: number;
        risk: string;
        reversible: string;
        title: string;
        summary: string;
        details_json: string;
        decisions_json: string;
        expires_at: string | null;
      }>;

    const approvalPayloads = approvals.map((a) => ({
      id: a.id,
      runtimeApprovalId: a.runtime_approval_id,
      sessionId: a.session_id,
      category: a.category,
      risk: a.risk,
      reversible: a.reversible,
      title: a.title,
      summary: a.summary,
      decisions: JSON.parse(a.decisions_json) as string[],
      expiresAt: a.expires_at,
      version: a.version,
    }));

    const questions = this.config.db
      .prepare(
        `SELECT id, session_id, runtime_question_id, state, version, prompt, options_json
         FROM questions
         WHERE state = 'pending'
         ORDER BY created_at ASC`
      )
      .all() as Array<{
        id: string;
        session_id: string;
        runtime_question_id: string;
        state: string;
        version: number;
        prompt: string;
        options_json: string | null;
      }>;

    const questionPayloads = questions.map((q) => ({
      id: q.id,
      sessionId: q.session_id,
      prompt: q.prompt,
      options: q.options_json ? JSON.parse(q.options_json) as string[] : null,
    }));

    const latestSequence = this.config.db
      .prepare(`SELECT COALESCE(MAX(sequence), 0) AS seq FROM event_journal`)
      .get() as { seq: number } | undefined;

    return this.buildEnvelope('host.snapshot', {
      hostId: this.config.hostId,
      sessions: sessionPayloads,
      approvals: approvalPayloads,
      questions: questionPayloads,
      sequence: latestSequence?.seq ?? 0,
    });
  }

  private handleMessage(client: AuthenticatedClient, msg: unknown): void {
    const parsed = UcpEnvelopeSchema.safeParse(msg);
    if (!parsed.success) return;

    const envelope = parsed.data;
    if (!envelope.type.startsWith('command/')) return;

    const payload = envelope.payload as Record<string, unknown>;
    const idempotencyKey = payload.idempotencyKey as string | undefined;
    if (!idempotencyKey) return;

    let sessionId = envelope.sessionId as string | undefined;
    let adapter: RuntimeAdapter | undefined;
    if (envelope.type === 'command/start') {
      adapter = this.config.resolveAdapter('');
    } else {
      adapter = sessionId ? this.config.resolveAdapter(sessionId) : undefined;
    }
    if (!adapter) return;

    const commandId = randomUUID();
    const result = this.config.commandLedger.accept({
      id: commandId,
      idempotencyKey,
      deviceId: client.devicePublicKey,
      sessionId: sessionId ?? null,
      commandType: envelope.type,
      payloadHash: JSON.stringify(payload),
    });

    if (result === 'duplicate') {
      this.sendEncrypted(client, this.buildEnvelope('command.ack', { commandId, status: 'duplicate' }, envelope.correlationId));
      return;
    }

    this.config.commandLedger.markDispatched(commandId);
    this.dispatchCommand(
      adapter,
      sessionId,
      envelope.type,
      payload,
      commandId,
      idempotencyKey,
      client,
      envelope.correlationId,
    );
  }

  private handleMessageLegacy(ws: WebSocket, msg: unknown): void {
    const parsed = UcpEnvelopeSchema.safeParse(msg);
    if (!parsed.success) {
      console.error('[gateway-debug] envelope parse failed:', parsed.error.format());
      return;
    }

    const envelope = parsed.data;
    if (!envelope.type.startsWith('command/')) return;

    const payload = envelope.payload as Record<string, unknown>;
    const idempotencyKey = payload.idempotencyKey as string | undefined;
    if (!idempotencyKey) return;

    let sessionId = envelope.sessionId as string | undefined;
    let adapter: RuntimeAdapter | undefined;
    if (envelope.type === 'command/start') {
      adapter = this.config.resolveAdapter('');
    } else {
      adapter = sessionId ? this.config.resolveAdapter(sessionId) : undefined;
    }
    if (!adapter) return;

    const commandId = randomUUID();
    let result: 'accepted' | 'duplicate';
    try {
      result = this.config.commandLedger.accept({
        id: commandId,
        idempotencyKey,
        deviceId: 'mobile',
        sessionId: sessionId ?? null,
        commandType: envelope.type,
        payloadHash: JSON.stringify(payload),
      });
    } catch {
      return;
    }

    if (result === 'duplicate') {
      this.sendToClient(ws, this.buildEnvelope('command.ack', { commandId, status: 'duplicate' }, envelope.correlationId));
      return;
    }

    this.config.commandLedger.markDispatched(commandId);
    this.dispatchCommandLegacy(
      adapter,
      sessionId,
      envelope.type,
      payload,
      commandId,
      idempotencyKey,
      ws,
      envelope.correlationId,
    );
  }

  private async dispatchCommand(
    adapter: RuntimeAdapter,
    sessionId: string | undefined,
    type: string,
    payload: Record<string, unknown>,
    commandId: string,
    idempotencyKey: string,
    client: AuthenticatedClient,
    correlationId?: string,
  ): Promise<void> {
    try {
      switch (type) {
        case 'command/start': {
          const instruction = String(payload.instruction ?? 'Start session');
          const newSessionId = await adapter.startSession({ instruction });
          this.config.registerSession?.(newSessionId);
          this.config.commandLedger.markComplete(commandId, { dispatched: true, sessionId: newSessionId });
          this.sendEncrypted(client, this.buildEnvelope('command.ack', { commandId, status: 'dispatched', sessionId: newSessionId }, correlationId));
          break;
        }
        case 'command/approve': {
          const activeSessionId = this.requireSessionId(sessionId, type);
          const approvalId = String(payload.approvalId ?? '');
          const decision = String(payload.decision ?? 'approved');
          await adapter.resolveApproval(activeSessionId, approvalId, decision, idempotencyKey);
          break;
        }
        case 'command/send': {
          const activeSessionId = this.requireSessionId(sessionId, type);
          const text = String(payload.text ?? '');
          await adapter.sendInstruction(activeSessionId, text, idempotencyKey);
          break;
        }
        case 'command/cancel': {
          const activeSessionId = this.requireSessionId(sessionId, type);
          await adapter.cancelSession(activeSessionId, idempotencyKey);
          break;
        }
        case 'command/answer': {
          const activeSessionId = this.requireSessionId(sessionId, type);
          const questionId = String(payload.questionId ?? '');
          const answer = payload.answer;
          await adapter.answerQuestion(activeSessionId, questionId, answer, idempotencyKey);
          break;
        }
        default:
          this.config.commandLedger.markFailed(commandId, { error: 'unknown_command' });
          return;
      }
      if (type !== 'command/start') {
        this.config.commandLedger.markComplete(commandId, { dispatched: true });
        this.sendEncrypted(client, this.buildEnvelope('command.ack', { commandId, status: 'dispatched' }, correlationId));
      }
    } catch (err) {
      this.config.commandLedger.markFailed(commandId, { error: String(err) });
      this.sendEncrypted(client, this.buildEnvelope('command.nack', { commandId, error: String(err) }, correlationId));
    }
  }

  private async dispatchCommandLegacy(
    adapter: RuntimeAdapter,
    sessionId: string | undefined,
    type: string,
    payload: Record<string, unknown>,
    commandId: string,
    idempotencyKey: string,
    ws: WebSocket,
    correlationId?: string,
  ): Promise<void> {
    try {
      switch (type) {
        case 'command/start': {
          const instruction = String(payload.instruction ?? 'Start session');
          const newSessionId = await adapter.startSession({ instruction });
          this.config.registerSession?.(newSessionId);
          this.config.commandLedger.markComplete(commandId, { dispatched: true, sessionId: newSessionId });
          this.sendToClient(ws, this.buildEnvelope('command.ack', { commandId, status: 'dispatched', sessionId: newSessionId }, correlationId));
          break;
        }
        case 'command/approve': {
          const activeSessionId = this.requireSessionId(sessionId, type);
          const approvalId = String(payload.approvalId ?? '');
          const decision = String(payload.decision ?? 'approved');
          await adapter.resolveApproval(activeSessionId, approvalId, decision, idempotencyKey);
          break;
        }
        case 'command/send': {
          const activeSessionId = this.requireSessionId(sessionId, type);
          const text = String(payload.text ?? '');
          await adapter.sendInstruction(activeSessionId, text, idempotencyKey);
          break;
        }
        case 'command/cancel': {
          const activeSessionId = this.requireSessionId(sessionId, type);
          await adapter.cancelSession(activeSessionId, idempotencyKey);
          break;
        }
        case 'command/answer': {
          const activeSessionId = this.requireSessionId(sessionId, type);
          const questionId = String(payload.questionId ?? '');
          const answer = payload.answer;
          await adapter.answerQuestion(activeSessionId, questionId, answer, idempotencyKey);
          break;
        }
        default:
          this.config.commandLedger.markFailed(commandId, { error: 'unknown_command' });
          return;
      }
      if (type !== 'command/start') {
        this.config.commandLedger.markComplete(commandId, { dispatched: true });
        this.sendToClient(ws, this.buildEnvelope('command.ack', { commandId, status: 'dispatched' }, correlationId));
      }
    } catch (err) {
      this.config.commandLedger.markFailed(commandId, { error: String(err) });
      this.sendToClient(ws, this.buildEnvelope('command.nack', { commandId, error: String(err) }, correlationId));
    }
  }

  private isInitializeMessage(msg: unknown): boolean {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      (msg as Record<string, unknown>).type === 'connection.initialize'
    );
  }

  private buildEnvelope(type: string, payload: Record<string, unknown>, correlationId?: string, sequence?: number): UcpEnvelope {
    const envelope: UcpEnvelope = {
      protocol: 'ucp',
      version: 1,
      messageId: asMessageId(randomUUID()),
      type,
      timestamp: asTimestamp(new Date().toISOString()),
      hostId: this.config.hostId,
      payload,
    };
    if (sequence !== undefined) {
      (envelope as { sequence?: number }).sequence = sequence;
    }
    if (correlationId) {
      (envelope as { correlationId?: string }).correlationId = correlationId;
    }
    return envelope;
  }

  private isOversizedMessage(raw: WebSocket.RawData): boolean {
    if (typeof raw === 'string') {
      return Buffer.byteLength(raw) > MAX_JSON_FRAME_BYTES;
    }
    if (raw instanceof ArrayBuffer) {
      return raw.byteLength > MAX_BINARY_FRAME_BYTES;
    }
    if (Array.isArray(raw)) {
      const total = raw.reduce((sum, chunk) => sum + chunk.length, 0);
      return total > MAX_BINARY_FRAME_BYTES;
    }
    return raw.length > MAX_JSON_FRAME_BYTES;
  }

  private messageToString(raw: WebSocket.RawData): string {
    if (typeof raw === 'string') return raw;
    if (raw instanceof ArrayBuffer) {
      return Buffer.from(raw).toString('utf8');
    }
    if (Array.isArray(raw)) {
      return Buffer.concat(raw).toString('utf8');
    }
    return raw.toString('utf8');
  }

  private requireSessionId(sessionId: string | undefined, commandType: string): string {
    if (!sessionId) {
      throw new Error(`Missing sessionId for ${commandType}`);
    }
    return sessionId;
  }
}
