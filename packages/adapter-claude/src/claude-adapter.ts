/**
 * Claude Runtime Adapter
 * Implements RuntimeAdapter interface for Claude via Agent SDK query/session flow.
 * // ponytail: beta adapter — session recovery is best-effort per AGENTS.md
 */

import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import type {
  RuntimeAdapter,
  AdapterEvent,
  ProbeResult,
  StartSessionParams,
  ReconcileResult,
} from '@agent-deck/adapter-contract';

const RUNTIME_TYPE = 'claude' as const;
const ADAPTER_VERSION = '0.1.0-claude';

interface SessionMapping {
  bridgeSessionId: string;
  claudeSessionId: string | null;
  workingDirectory: string;
  state: 'running' | 'completed' | 'failed' | 'cancelled';
}

/**
 * Claude adapter using the Claude Agent SDK (query flow).
 * Spawns a claude process per session and communicates via stdin/stdout JSON.
 * // ponytail: single process per session; pool if perf requires
 */
export class ClaudeAdapter extends EventEmitter implements RuntimeAdapter {
  readonly runtimeType = RUNTIME_TYPE;
  readonly adapterVersion = ADAPTER_VERSION;

  private readonly sessions = new Map<string, SessionMapping>();
  private readonly processes = new Map<string, ChildProcess>();
  private available = false;
  private claudeBinary: string | null = null;

  async probe(): Promise<ProbeResult> {
    // Try to find claude binary
    const paths = [
      'claude',
      '/usr/local/bin/claude',
      `${process.env.HOME}/.local/bin/claude`,
    ];

    for (const bin of paths) {
      try {
        const result = await this.execCommand(bin, ['--version'], 5000);
        if (result.includes('claude') || result.includes('Claude')) {
          this.claudeBinary = bin;
          this.available = true;
          return { available: true, version: result.trim().split('\n')[0] };
        }
      } catch {
        // try next
      }
    }

    return { available: false, error: 'Claude CLI not found' };
  }

  async startSession(params: StartSessionParams): Promise<string> {
    if (!this.claudeBinary) throw new Error('Claude binary not discovered');

    const bridgeSessionId = `claude-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const workingDirectory = params.workingDirectory ?? process.cwd();

    const session: SessionMapping = {
      bridgeSessionId,
      claudeSessionId: null,
      workingDirectory,
      state: 'running',
    };
    this.sessions.set(bridgeSessionId, session);

    // Emit session started
    this.emitEvent({
      type: 'session.created',
      sessionId: bridgeSessionId,
      payload: {
        id: bridgeSessionId,
        title: params.instruction ?? 'Claude session',
        state: 'running',
        summary: '',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

    // Start query in background
    this.runQuery(bridgeSessionId, params.instruction ?? 'Continue working', workingDirectory);

    return bridgeSessionId;
  }

  async sendInstruction(
    sessionId: string,
    text: string,
    _idempotencyKey: string,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'running') return;

    this.emitEvent({
      type: 'instruction.accepted',
      sessionId,
      payload: { text },
      timestamp: new Date().toISOString(),
    });

    // Send follow-up query
    this.runQuery(sessionId, text, session.workingDirectory);
  }

  async cancelSession(sessionId: string, _idempotencyKey: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = 'cancelled';
    }

    const proc = this.processes.get(sessionId);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(sessionId);
    }

    this.emitEvent({
      type: 'session.cancelled',
      sessionId,
      payload: {},
      timestamp: new Date().toISOString(),
    });
  }

  async resolveApproval(
    sessionId: string,
    approvalId: string,
    decision: string,
    _idempotencyKey: string,
  ): Promise<void> {
    this.emitEvent({
      type: 'approval.resolved',
      sessionId,
      payload: { approvalId, decision },
      timestamp: new Date().toISOString(),
    });
  }

  async answerQuestion(
    sessionId: string,
    questionId: string,
    answer: unknown,
    _idempotencyKey: string,
  ): Promise<void> {
    this.emitEvent({
      type: 'question.answered',
      sessionId,
      payload: { questionId, answer },
      timestamp: new Date().toISOString(),
    });
  }

  async reconcile(sessionId: string): Promise<ReconcileResult> {
    const session = this.sessions.get(sessionId);
    if (!session) return { sessionExists: false };
    return { sessionExists: true, state: session.state };
  }

  async dispose(): Promise<void> {
    for (const [, proc] of this.processes) {
      proc.kill('SIGTERM');
    }
    this.processes.clear();
    this.sessions.clear();
    this.removeAllListeners();
  }

  private runQuery(sessionId: string, prompt: string, cwd: string): void {
    if (!this.claudeBinary) return;

    const proc = spawn(this.claudeBinary, [
      '--print', prompt,
      '--output-format', 'json',
    ], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.processes.set(sessionId, proc);

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      this.processes.delete(sessionId);
      const session = this.sessions.get(sessionId);
      if (!session || session.state === 'cancelled') return;

      if (code === 0) {
        session.state = 'completed';
        this.emitEvent({
          type: 'session.completed',
          sessionId,
          payload: {
            id: sessionId,
            summary: this.extractSummary(stdout),
            version: 2,
            updatedAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        session.state = 'failed';
        this.emitEvent({
          type: 'session.failed',
          sessionId,
          payload: {
            id: sessionId,
            error: stderr || `Exit code ${code}`,
            version: 2,
            updatedAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    proc.on('error', (err) => {
      this.processes.delete(sessionId);
      const session = this.sessions.get(sessionId);
      if (session) session.state = 'failed';
      this.emitEvent({
        type: 'session.failed',
        sessionId,
        payload: { id: sessionId, error: String(err), version: 2, updatedAt: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });
    });
  }

  private extractSummary(stdout: string): string {
    try {
      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      if (typeof parsed.result === 'string') return parsed.result;
      if (typeof parsed.output === 'string') return parsed.output;
    } catch {
      // not JSON, use raw text
    }
    return stdout.slice(0, 500).trim();
  }

  private emitEvent(event: AdapterEvent): void {
    this.emit('session_event', event);
  }

  private execCommand(cmd: string, args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('timeout'));
      }, timeoutMs);

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', () => {
        clearTimeout(timer);
        if (stdout) resolve(stdout);
        else reject(new Error(stderr || 'no output'));
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
