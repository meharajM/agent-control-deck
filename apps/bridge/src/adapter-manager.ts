import { randomUUID } from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';
import type { RuntimeAdapter, AdapterEvent, ProbeResult } from '@agent-deck/adapter-contract';
import type { EventJournal, ApprovalService, QuestionService } from '@agent-deck/bridge-core';
import type { UcpEnvelope, HostId, MessageId } from '@agent-deck/protocol';
import { asMessageId, asHostId, asTimestamp } from '@agent-deck/protocol';

export interface AdapterManagerDeps {
  db: BetterSqlite3.Database;
  journal: EventJournal;
  approvals: ApprovalService;
  questions: QuestionService;
  broadcast: (envelope: UcpEnvelope) => void;
  hostId: HostId;
}

export class AdapterManager {
  private readonly adapters = new Map<string, { adapter: RuntimeAdapter; probe: ProbeResult }>();
  private readonly listeners = new Map<string, (event: AdapterEvent) => void>();
  private readonly knownSessions = new Map<string, string>();
  private selectedAdapterId: string | null = null;

  constructor(private readonly deps: AdapterManagerDeps) {}

  async registerAdapter(id: string, adapter: RuntimeAdapter): Promise<void> {
    if (this.selectedAdapterId && this.selectedAdapterId !== id) {
      throw new Error(`AdapterManager already has selected runtime "${this.selectedAdapterId}"`);
    }

    const listener = (event: AdapterEvent) => this.handleEvent(id, event);
    this.listeners.set(id, listener);
    adapter.on('session_event', listener);
    const probe = await adapter.probe();
    this.adapters.set(id, { adapter, probe });
    this.selectedAdapterId = id;
    this.ensureRuntimeInstance(id, adapter, probe);
  }

  getAdapter(id: string): RuntimeAdapter | undefined {
    return this.adapters.get(id)?.adapter;
  }

  getSelectedAdapter(): RuntimeAdapter | undefined {
    return this.selectedAdapterId ? this.adapters.get(this.selectedAdapterId)?.adapter : undefined;
  }

  getAdapterForSession(sessionId: string): RuntimeAdapter | undefined {
    const adapterId = this.knownSessions.get(sessionId) ?? this.selectedAdapterId;
    return adapterId ? this.adapters.get(adapterId)?.adapter : undefined;
  }

  recordSessionStart(sessionId: string, adapterId = this.selectedAdapterId): void {
    if (!adapterId) {
      throw new Error('No selected adapter is registered');
    }

    this.ensureSession(sessionId, adapterId);
  }

  async dispose(): Promise<void> {
    for (const [id, entry] of this.adapters) {
      entry.adapter.off('session_event', this.listeners.get(id)!);
      await entry.adapter.dispose();
    }
    this.adapters.clear();
    this.listeners.clear();
    this.knownSessions.clear();
    this.selectedAdapterId = null;
  }

  private handleEvent(adapterId: string, event: AdapterEvent): void {
    if (event.sessionId) {
      this.ensureSession(event.sessionId, adapterId);
    }

    const sequence = this.deps.journal.append(
      event.sessionId,
      event.type,
      event.payload,
    );

    if (event.type === 'approval.requested') {
      this.createApproval(event);
    }

    if (event.type === 'approval.resolved') {
      this.resolveApproval(event);
    }

    if (event.type === 'question.requested') {
      this.createQuestion(event);
    }

    if (event.type === 'question.answered') {
      this.answerQuestion(event);
    }

    if (event.type.startsWith('session.')) {
      this.updateSession(event);
    }

    const envelope = buildEventEnvelope(event, this.deps.hostId, sequence);
    this.deps.broadcast(envelope);
  }

  private ensureRuntimeInstance(adapterId: string, adapter: RuntimeAdapter, probe: ProbeResult): string {
    const runtimeInstanceId = this.getRuntimeInstanceId(adapterId);
    const now = new Date().toISOString();
    this.deps.db
      .prepare(
        `INSERT OR IGNORE INTO runtime_instances (id, runtime, mode, state, capabilities_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        runtimeInstanceId,
        adapter.runtimeType,
        'managed',
        probe.available ? 'active' : 'offline',
        '{}',
        now,
        now,
      );
    this.deps.db
      .prepare(
        `UPDATE runtime_instances
         SET runtime = @runtime,
             version = @version,
             state = @state,
             updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id: runtimeInstanceId,
        runtime: adapter.runtimeType,
        version: probe.version ?? null,
        state: probe.available ? 'active' : 'offline',
        updatedAt: now,
      });

    return runtimeInstanceId;
  }

  private ensureSession(sessionId: string, adapterId: string): void {
    if (this.knownSessions.has(sessionId)) return;

    const entry = this.adapters.get(adapterId);
    if (!entry) {
      throw new Error(`Unknown adapter "${adapterId}"`);
    }

    const runtimeInstanceId = this.ensureRuntimeInstance(adapterId, entry.adapter, entry.probe);
    const now = new Date().toISOString();
    this.deps.db
      .prepare(
        `INSERT OR IGNORE INTO sessions (id, runtime_instance_id, runtime_session_id, title, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(sessionId, runtimeInstanceId, sessionId, 'Session', 'running', now, now);
    this.deps.db
      .prepare(
        `UPDATE sessions
         SET runtime_instance_id = @runtimeInstanceId,
             runtime_session_id = @runtimeSessionId,
             updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id: sessionId,
        runtimeInstanceId,
        runtimeSessionId: sessionId,
        updatedAt: now,
      });
    this.knownSessions.set(sessionId, adapterId);
  }

  private getRuntimeInstanceId(adapterId: string): string {
    return `runtime:${adapterId}`;
  }

  private updateSession(event: AdapterEvent): void {
    const payload = event.payload as Record<string, unknown>;
    const states: Record<string, string> = {
      'session.started': 'running',
      'session.completed': 'completed',
      'session.failed': 'failed',
      'session.cancelled': 'cancelled',
      'session.interrupted': 'interrupted',
    };
    const state = states[event.type];
    const summary = typeof payload.summary === 'string' ? payload.summary : undefined;
    const currentAction =
      typeof payload.currentAction === 'string'
        ? payload.currentAction
        : typeof payload.message === 'string'
          ? payload.message
          : undefined;

    if (state === undefined && summary === undefined && currentAction === undefined) return;

    this.deps.db
      .prepare(
        `UPDATE sessions
         SET state = COALESCE(@state, state),
             summary = COALESCE(@summary, summary),
             current_action = COALESCE(@currentAction, current_action),
             version = version + 1,
             updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id: event.sessionId,
        state: state ?? null,
        summary: summary ?? null,
        currentAction: currentAction ?? null,
        updatedAt: event.timestamp,
      });
  }

  private createApproval(event: AdapterEvent): void {
    const p = event.payload as Record<string, unknown>;
    this.deps.approvals.create({
      id: randomUUID(),
      sessionId: event.sessionId,
      runtimeApprovalId: String(p.approvalId ?? randomUUID()),
      category: String(p.category ?? 'unknown'),
      risk: String(p.risk ?? 'unknown'),
      reversible: String(p.reversible ?? 'unknown'),
      title: String(p.title ?? ''),
      summary: String(p.summary ?? ''),
      details: p.details,
      decisions: p.decisions ?? [],
    });
  }

  private resolveApproval(event: AdapterEvent): void {
    const p = event.payload as Record<string, unknown>;
    const approvalId = String(p.approvalId ?? '');
    const decision = String(p.decision ?? 'resolved');
    const pending = this.deps.approvals.getPending(event.sessionId);
    const match = pending.find((a) => a.runtimeApprovalId === approvalId);
    if (match) {
      // ponytail: runtime-side resolve has no device; skip the CAS update since the
      // adapter is the authority and we just need the DB state to reflect the decision.
      this.deps.db
        .prepare(
          `UPDATE approvals SET state = @decision, version = version + 1, updated_at = @now
           WHERE id = @id AND state = 'pending'`
        )
        .run({ decision, now: new Date().toISOString(), id: match.id });
    }
  }

  private createQuestion(event: AdapterEvent): void {
    const p = event.payload as Record<string, unknown>;
    this.deps.questions.create({
      id: randomUUID(),
      sessionId: event.sessionId,
      runtimeQuestionId: String(p.questionId ?? randomUUID()),
      prompt: String(p.prompt ?? ''),
      options: Array.isArray(p.options) ? p.options : null,
    });
  }

  private answerQuestion(event: AdapterEvent): void {
    const p = event.payload as Record<string, unknown>;
    const questionId = String(p.questionId ?? '');
    const pending = this.deps.questions.getPending(event.sessionId);
    const match = pending.find((q) => q.runtimeQuestionId === questionId);
    if (match) {
      this.deps.db
        .prepare(
          `UPDATE questions SET state = 'answered', answer_json = @answerJson, version = version + 1, updated_at = @now
           WHERE id = @id AND state = 'pending'`
        )
        .run({ answerJson: JSON.stringify(p.answer), now: new Date().toISOString(), id: match.id });
    }
  }
}

function buildEventEnvelope(
  event: AdapterEvent,
  hostId: HostId,
  sequence: number,
): UcpEnvelope {
  const envelope: UcpEnvelope = {
    protocol: 'ucp',
    version: 1,
    messageId: asMessageId(randomUUID()),
    // ponytail: bare event type — mobile store matches on e.g. "session.created" not "event/session.created"
    type: event.type,
    sequence,
    timestamp: asTimestamp(event.timestamp),
    hostId,
    payload: (typeof event.payload === 'object' && event.payload !== null
      ? event.payload
      : {}) as Record<string, unknown>,
  };
  if (event.sessionId) {
    (envelope as { sessionId?: string }).sessionId = event.sessionId;
  }
  return envelope;
}
