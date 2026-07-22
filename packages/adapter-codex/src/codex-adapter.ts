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
      this.binaryInfo = { path: 'codex', version: result.version };
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

    const createResult = await this.client.createThread({
      workingDirectory,
      initialInstruction: params.instruction,
    });

    const threadId = (createResult.result as { threadId: string })?.threadId;
    if (!threadId) {
      throw new Error('Failed to create Codex thread: ' + JSON.stringify(createResult));
    }

    this.sessions.set(bridgeSessionId, {
      bridgeSessionId,
      codexThreadId: threadId,
      state: 'running',
      workingDirectory,
    });

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

    await this.client.sendTurn(mapping.codexThreadId, text, idempotencyKey);
  }

  async cancelSession(sessionId: string, idempotencyKey: string): Promise<void> {
    const mapping = this.sessions.get(sessionId);
    if (!mapping) return;
    if (!this.client) return;

    mapping.state = 'cancelled';
    await this.client.cancelThread(mapping.codexThreadId, idempotencyKey);
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
      const result = await this.client.getThread(mapping.codexThreadId);
      const thread = result.result as { status: string } | undefined;
      if (thread) {
        mapping.state = thread.status as SessionMapping['state'];
        return { sessionExists: true, state: thread.status };
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