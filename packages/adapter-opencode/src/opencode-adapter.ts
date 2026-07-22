/**
 * OpenCode Runtime Adapter
 * Implements RuntimeAdapter interface for OpenCode via HTTP + SSE.
 * // ponytail: single adapter class, minimal abstraction
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  RuntimeAdapter,
  AdapterEvent,
  ProbeResult,
  StartSessionParams,
  ReconcileResult,
} from '@agent-deck/adapter-contract';
import { ServerManager, type ServerInfo, type ServerManagerOptions } from './server-manager.js';
import { OpenCodeClient, type OpenCodeEvent } from './opencode-client.js';
import { normalizeEvent, normalizeSessionStatus } from './normalization/event-normalizer.js';

const RUNTIME_TYPE = 'opencode' as const;
const ADAPTER_VERSION = '0.1.0';

interface SessionMapping {
  bridgeSessionId: string;
  opencodeSessionId: string;
  workingDirectory: string | undefined;
  status: 'running' | 'idle' | 'completed' | 'failed';
  capabilities: AdapterCapabilities;
}

interface AdapterCapabilities {
  send: boolean;
  steerInFlight: boolean;
  cancel: boolean;
  retry: boolean;
  resume: boolean;
  fork: boolean;
  approvals: {
    request: boolean;
    respond: boolean;
    cancel: boolean;
  };
  questions: {
    ask: boolean;
    answer: boolean;
  };
  previews: {
    diff: boolean;
    tests: boolean;
    commands: boolean;
    files: boolean;
    rawTranscript: boolean;
  };
}

const SUPPORTED_CAPABILITIES: AdapterCapabilities = {
  send: true,
  steerInFlight: false,
  cancel: true,
  retry: false,
  resume: false,
  fork: false,
  approvals: {
    request: true,
    respond: true,
    cancel: false,
  },
  questions: {
    ask: true,
    answer: true,
  },
  previews: {
    diff: true,
    tests: false,
    commands: false,
    files: true,
    rawTranscript: true,
  },
};

interface AdapterSession {
  sessionId: string;
  status: 'running' | 'idle' | 'completed' | 'failed';
  capabilities: AdapterCapabilities;
  metadata: { opencodeSessionId: string };
}

/**
 * OpenCode adapter implementation.
 * Manages opencode serve subprocess, HTTP API, and SSE event stream.
 */
export class OpenCodeAdapter extends EventEmitter implements RuntimeAdapter {
  readonly runtimeType = RUNTIME_TYPE;
  readonly adapterVersion = ADAPTER_VERSION;

  private serverManager: ServerManager;
  private client: OpenCodeClient | null = null;
  private sessions = new Map<string, SessionMapping>();
  private idempotencyKeys = new Set<string>();
  private disposed = false;

constructor(options: { cwd?: string } = {}) {
    super();
    const serverOptions: ServerManagerOptions = { cwd: options.cwd };
    this.serverManager = new ServerManager(serverOptions);
    this.serverManager.on('exit', () => this.handleServerExit());
  }

  async probe(): Promise<ProbeResult> {
    try {
      const { spawn } = await import('node:child_process');
      // ponytail: guard against both error + close firing on ENOENT
      let settled = false;
      const version = await new Promise<string>((resolve, reject) => {
        const proc = spawn('opencode', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
        let output = '';
        proc.stdout?.on('data', (d: Buffer) => (output += d.toString()));
        proc.on('close', (code: number | null) => {
          if (settled) return;
          settled = true;
          code === 0 ? resolve(output.trim()) : reject(new Error(`exit ${code}`));
        });
        proc.on('error', (err: Error) => {
          if (settled) return;
          settled = true;
          reject(err);
        });
      });

      const serverInfo = await this.serverManager.start();
      const client = new OpenCodeClient(serverInfo);
      const healthy = await client.healthCheck();
      await this.serverManager.stop();

      return { available: healthy, version };
    } catch (err) {
      return { available: false, error: String(err) };
    }
  }

  async startSession(params: StartSessionParams): Promise<string> {
    this.ensureNotDisposed();

    // Start server if needed
    if (!this.client) {
      const serverInfo = await this.serverManager.start();
      this.client = new OpenCodeClient(serverInfo);
      this.client.on('event', (event) => this.handleOpenCodeEvent(event));
      this.client.connectEvents();
    }

    // Create OpenCode session
    const opencodeSession = await this.client.createSession(params.workingDirectory);

    // Map bridge session ID to OpenCode session ID
    const bridgeSessionId = randomUUID();
    const mapping: SessionMapping = {
      bridgeSessionId,
      opencodeSessionId: opencodeSession.id,
      workingDirectory: params.workingDirectory ?? undefined,
      status: normalizeSessionStatus(opencodeSession.status),
      capabilities: SUPPORTED_CAPABILITIES,
    };

    this.sessions.set(bridgeSessionId, mapping);

    // Emit session started event
    this.emit('session_event', {
      type: 'session.started',
      sessionId: bridgeSessionId,
      payload: { opencodeSessionId: opencodeSession.id, workingDirectory: params.workingDirectory },
      timestamp: new Date().toISOString(),
    });

    return bridgeSessionId;
  }

  async sendInstruction(sessionId: string, text: string, idempotencyKey: string): Promise<void> {
    this.ensureNotDisposed();
    this.checkIdempotency(idempotencyKey);

    const mapping = this.getSessionMapping(sessionId);
    await this.client!.sendPrompt(mapping.opencodeSessionId, text);

    this.emit('session_event', {
      type: 'instruction.accepted',
      sessionId,
      payload: { text, idempotencyKey },
      timestamp: new Date().toISOString(),
    });
  }

  async cancelSession(sessionId: string, idempotencyKey: string): Promise<void> {
    this.ensureNotDisposed();
    this.checkIdempotency(idempotencyKey);

    const mapping = this.getSessionMapping(sessionId);
    await this.client!.abortSession(mapping.opencodeSessionId);

    this.emit('session_event', {
      type: 'session.cancelled',
      sessionId,
      payload: { idempotencyKey },
      timestamp: new Date().toISOString(),
    });
  }

  async resolveApproval(
    sessionId: string,
    approvalId: string,
    decision: string,
    idempotencyKey: string
  ): Promise<void> {
    this.ensureNotDisposed();
    this.checkIdempotency(idempotencyKey);

    const mapping = this.getSessionMapping(sessionId);
    await this.client!.respondToPermission(mapping.opencodeSessionId, approvalId, decision as 'allow' | 'deny');

    this.emit('session_event', {
      type: 'approval.resolved',
      sessionId,
      payload: { approvalId, decision, idempotencyKey },
      timestamp: new Date().toISOString(),
    });
  }

  async answerQuestion(
    sessionId: string,
    questionId: string,
    answer: unknown,
    idempotencyKey: string
  ): Promise<void> {
    // OpenCode uses same messageID mechanism for questions/permissions
    return this.resolveApproval(sessionId, questionId, String(answer), idempotencyKey);
  }

  async reconcile(sessionId: string): Promise<ReconcileResult> {
    this.ensureNotDisposed();

    const mapping = this.sessions.get(sessionId);
    if (!mapping) {
      return { sessionExists: false };
    }
    const opencodeSession = await this.client!.getSession(mapping.opencodeSessionId);

    if (!opencodeSession) {
      return { sessionExists: false };
    }

    mapping.status = normalizeSessionStatus(opencodeSession.status);

    return {
      sessionExists: true,
      state: mapping.status,
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    this.client?.disconnectEvents();
    await this.serverManager.stop();

    this.sessions.clear();
    this.idempotencyKeys.clear();
    this.removeAllListeners();
  }

  // EventEmitter interface for 'session_event'
  override on(event: 'session_event', listener: (event: AdapterEvent) => void): this {
    return super.on(event, listener);
  }

  override off(event: 'session_event', listener: (event: AdapterEvent) => void): this {
    return super.off(event, listener);
  }

  /**
   * Handle incoming OpenCode SSE events and normalize to AdapterEvent.
   */
  private handleOpenCodeEvent(event: OpenCodeEvent): void {
    const normalized = normalizeEvent(event);
    if (!normalized) return;

    // Map OpenCode session ID to bridge session ID
    const sessionId = this.findBridgeSessionId(normalized.sessionId);
    if (!sessionId) return;

    // Update local session status
    const mapping = this.sessions.get(sessionId);
    if (mapping && normalized.type.startsWith('session.')) {
      mapping.status = (normalized.payload as { status?: string }).status as SessionMapping['status'] ?? mapping.status;
    }

    // Emit normalized event with bridge session ID
    this.emit('session_event', {
      ...normalized,
      sessionId,
    });
  }

  /**
   * Find bridge session ID by OpenCode session ID.
   */
  private findBridgeSessionId(opencodeSessionId: string): string | null {
    for (const [bridgeId, mapping] of this.sessions) {
      if (mapping.opencodeSessionId === opencodeSessionId) {
        return bridgeId;
      }
    }
    return null;
  }

  /**
   * Get session mapping or throw.
   */
  private getSessionMapping(sessionId: string): SessionMapping {
    const mapping = this.sessions.get(sessionId);
    if (!mapping) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return mapping;
  }

  /**
   * Track idempotency key to prevent duplicate operations.
   * // ponytail: simple in-memory set, bridge DB is source of truth
   */
  private checkIdempotency(key: string): void {
    if (this.idempotencyKeys.has(key)) {
      throw new Error(`Duplicate idempotency key: ${key}`);
    }
    this.idempotencyKeys.add(key);
  }

  /**
   * Handle unexpected server exit - mark all sessions as failed.
   */
  private handleServerExit(): void {
    this.client = null;
    for (const [sessionId, mapping] of this.sessions) {
      mapping.status = 'failed';
      this.emit('session_event', {
        type: 'session.failed',
        sessionId,
        payload: { reason: 'server_exited' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('Adapter has been disposed');
    }
  }

  /**
   * Get session by bridge ID (for bridge queries).
   */
  getSession(sessionId: string): AdapterSession | undefined {
    const mapping = this.sessions.get(sessionId);
    if (!mapping) return undefined;

    return {
      sessionId,
      status: mapping.status,
      capabilities: SUPPORTED_CAPABILITIES,
      metadata: { opencodeSessionId: mapping.opencodeSessionId },
    };
  }

  /**
   * List all active sessions.
   */
  listSessions(): AdapterSession[] {
    return Array.from(this.sessions.values()).map((m) => ({
      sessionId: m.bridgeSessionId,
      status: m.status,
      capabilities: SUPPORTED_CAPABILITIES,
      metadata: { opencodeSessionId: m.opencodeSessionId },
    }));
  }
}

/**
 * Factory function for creating OpenCode adapter.
 * Used by bridge adapter registry.
 */
export function createOpenCodeAdapter(options?: { cwd?: string }): RuntimeAdapter {
  return new OpenCodeAdapter(options);
}