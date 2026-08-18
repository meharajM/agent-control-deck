import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import {
  probeCodex,
  spawnCodexAppServer,
  type CodexBinaryInfo,
} from './binary-discovery.js';
import { CodexClient } from './codex-client.js';
import { normalizeCodexEvent } from './normalization/event-normalizer.js';
import type {
  RuntimeAdapter,
  AdapterEvent,
  ProbeResult,
  StartSessionParams,
  ReconcileResult,
} from '@agent-deck/adapter-contract';

interface SessionMapping {
  bridgeSessionId: string;
  codexThreadId: string;
  codexTurnId: string | undefined;
  state: 'starting' | 'running' | 'completed' | 'cancelled' | 'failed';
  workingDirectory?: string;
}

export class CodexAdapter extends EventEmitter implements RuntimeAdapter {
  readonly runtimeType = 'codex' as const;
  readonly adapterVersion = '0.1.0';

  private client: CodexClient | null = null;
  private binaryInfo: CodexBinaryInfo | null = null;
  private readonly sessions = new Map<string, SessionMapping>();
  private disposed = false;

  async probe(): Promise<ProbeResult> {
    const result = await probeCodex();
    if (result.available && result.version) {
      this.binaryInfo = { path: result.path ?? 'codex', version: result.version };
    }
    return result;
  }

  async startSession(params: StartSessionParams): Promise<string> {
    if (!this.binaryInfo) {
      const probeResult = await this.probe();
      if (!probeResult.available) {
        throw new Error('Codex not available: ' + (probeResult.error ?? 'unknown'));
      }
    }

    const bridgeSessionId = randomUUID();
    const workingDirectory = params.workingDirectory ?? process.cwd();

    this.client = new CodexClient(spawnCodexAppServer(this.binaryInfo!.path));
    this.setupClientEvents();

    await this.client.initialize({
      protocolVersion: '2024-01-01',
      capabilities: {},
      clientInfo: { name: 'agent-deck-bridge', version: this.adapterVersion },
    });

    const startResult = await this.client.startThread({ cwd: workingDirectory });

    const threadId = (startResult.result as { thread?: { id?: string }; threadId?: string })?.thread?.id
      ?? (startResult.result as { threadId?: string })?.threadId;
    if (!threadId) {
      throw new Error('Failed to start Codex thread: ' + JSON.stringify(startResult));
    }

    const mapping: SessionMapping = {
      bridgeSessionId,
      codexThreadId: threadId,
      codexTurnId: undefined,
      state: 'running',
      workingDirectory,
    };
    this.sessions.set(bridgeSessionId, mapping);

    this.emit('session_event', {
      type: 'session.started',
      sessionId: bridgeSessionId,
      payload: { threadId, workingDirectory },
      timestamp: new Date().toISOString(),
    });

    if (params.instruction) {
      const turnResult = await this.client.startTurn(threadId, params.instruction, randomUUID());
      mapping.codexTurnId = getTurnId(turnResult.result);
    }

    return bridgeSessionId;
  }

  async sendInstruction(
    sessionId: string,
    text: string,
    idempotencyKey: string
  ): Promise<void> {
    const mapping = this.sessions.get(sessionId);
    if (!mapping) throw new Error(`Session not found: ${sessionId}`);
    if (!this.client) throw new Error('Client not initialized');

    const result = await this.client.startTurn(mapping.codexThreadId, text, idempotencyKey);
    mapping.codexTurnId = getTurnId(result.result) ?? mapping.codexTurnId;
  }

  async cancelSession(sessionId: string, idempotencyKey: string): Promise<void> {
    const mapping = this.sessions.get(sessionId);
    if (!mapping) return;
    if (!this.client) return;

    if (!mapping.codexTurnId) return;
    await this.client.interruptTurn(mapping.codexThreadId, mapping.codexTurnId);
  }

  async resolveApproval(
    sessionId: string,
    approvalId: string,
    decision: string,
    idempotencyKey: string
  ): Promise<void> {
    const mapping = this.sessions.get(sessionId);
    if (!mapping) throw new Error(`Session not found: ${sessionId}`);
    if (!this.client) throw new Error('Client not initialized');

    const codexDecision = decision === 'approved' ? 'approved' : 'rejected';
    await this.client.resolveApproval(mapping.codexThreadId, approvalId, codexDecision, idempotencyKey);
  }

  async answerQuestion(
    sessionId: string,
    questionId: string,
    answer: unknown,
    idempotencyKey: string
  ): Promise<void> {
    const mapping = this.sessions.get(sessionId);
    if (!mapping) throw new Error(`Session not found: ${sessionId}`);
    if (!this.client) throw new Error('Client not initialized');

    await this.client.answerQuestion(mapping.codexThreadId, questionId, answer, idempotencyKey);
  }

  async reconcile(sessionId: string): Promise<ReconcileResult> {
    const mapping = this.sessions.get(sessionId);
    if (!mapping) return { sessionExists: false };
    if (!this.client) return { sessionExists: true, state: mapping.state };

    try {
      const result = await this.client.readThread(mapping.codexThreadId);
      const thread = (result.result as { thread?: { status?: { type?: string } | string } })?.thread;
      if (thread) {
        const state = normalizeThreadState(thread.status);
        if (state) mapping.state = state;
        return { sessionExists: true, state: mapping.state };
      }
    } catch {
      // Thread may not exist anymore
    }
    return { sessionExists: true, state: mapping.state };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.client) {
      await this.client.dispose();
      this.client = null;
    }
    this.sessions.clear();
    this.removeAllListeners();
  }

  private setupClientEvents(): void {
    if (!this.client) return;

    this.client.on('notification', (notification) => {
      const bridgeSessionId = this.findBridgeSessionId(
        (notification.params as { threadId?: string })?.threadId
      );
      if (!bridgeSessionId) return;

      const event = normalizeCodexEvent(notification, bridgeSessionId);
      if (event) {
        const mapping = this.sessions.get(bridgeSessionId);
        if (mapping) {
          const params = notification.params as { turn?: { id?: string }; turnId?: string } | undefined;
          const turnId = params?.turn?.id ?? params?.turnId;
          if (notification.method === 'turn/started' && turnId) mapping.codexTurnId = turnId;
          if (notification.method === 'turn/completed') mapping.codexTurnId = undefined;
        }
        this.updateSessionState(bridgeSessionId, event);
        this.emit('session_event', event);
      }
    });

    this.client.on('close', () => {
      for (const [bridgeId, mapping] of this.sessions) {
        if (mapping.state === 'running') {
          mapping.state = 'cancelled';
          this.emit('session_event', {
            type: 'session.cancelled',
            sessionId: bridgeId,
            payload: { reason: 'connection_lost' },
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    this.client.on('error', (err) => {
      this.emit('error', err);
    });
  }

  private findBridgeSessionId(threadId: string | undefined): string | null {
    if (!threadId) return null;
    for (const [bridgeId, mapping] of this.sessions) {
      if (mapping.codexThreadId === threadId) return bridgeId;
    }
    return null;
  }

  private updateSessionState(bridgeSessionId: string, event: AdapterEvent): void {
    const mapping = this.sessions.get(bridgeSessionId);
    if (!mapping) return;

    switch (event.type) {
      case 'session.completed':
      case 'session.cancelled':
      case 'session.failed':
        mapping.state = event.type.replace('session.', '') as SessionMapping['state'];
        break;
    }
  }
}

function getTurnId(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const turn = (result as { turn?: { id?: unknown } }).turn;
  return turn && typeof turn.id === 'string' ? turn.id : undefined;
}

function normalizeThreadState(status: { type?: string } | string | undefined): SessionMapping['state'] | undefined {
  const type = typeof status === 'string' ? status : status?.type;
  switch (type) {
    case 'active':
      return 'running';
    case 'idle':
      return 'completed';
    case 'systemError':
      return 'failed';
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'interrupted':
      return 'cancelled';
    default:
      return undefined;
  }
}
