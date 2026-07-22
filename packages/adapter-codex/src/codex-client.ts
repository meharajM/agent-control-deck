import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { ChildProcess } from 'node:child_process';
import type { JsonRpcResponse, JsonRpcNotification, ThreadInfo } from './schema/codex-types.js';

interface PendingRequest {
  resolve: (value: JsonRpcResponse) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class CodexClient extends EventEmitter {
  private readonly process: ChildProcess;
  private readonly pending = new Map<string | number, PendingRequest>();
  private buffer = '';
  private closed = false;

  constructor(process: ChildProcess) {
    super();
    this.process = process;
    this.process.stdout?.on('data', (chunk: Buffer) => this.onData(chunk.toString()));
    this.process.stderr?.on('data', (chunk: Buffer) => this.emit('stderr', chunk.toString()));
    (this.process as unknown as EventEmitter).on('close', () => this.onClose());
    (this.process as unknown as EventEmitter).on('error', (err: Error) => this.emit('error', err));
  }

  private onData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if ('id' in msg && ('result' in msg || 'error' in msg)) {
          const pending = this.pending.get(msg.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pending.delete(msg.id);
            pending.resolve(msg as JsonRpcResponse);
          }
        } else if ('method' in msg) {
          this.emit('notification', msg as JsonRpcNotification);
        }
      } catch {
        this.emit('error', new Error(`Failed to parse JSON-RPC: ${line}`));
      }
    }
  }

  private onClose(): void {
    this.closed = true;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pending.clear();
    this.emit('close');
  }

  async initialize(params: {
    protocolVersion: string;
    capabilities: Record<string, unknown>;
    clientInfo: { name: string; version: string };
  }): Promise<JsonRpcResponse> {
    return this.sendRequest('initialize', params);
  }

  async listThreads(params: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    return this.sendRequest('threads/list', params);
  }

  async createThread(params: { workingDirectory: string; initialInstruction?: string | undefined }): Promise<JsonRpcResponse> {
    return this.sendRequest('threads/create', params);
  }

  async getThread(threadId: string): Promise<JsonRpcResponse> {
    return this.sendRequest('threads/get', { threadId });
  }

  async sendTurn(threadId: string, text: string, idempotencyKey: string): Promise<JsonRpcResponse> {
    return this.sendRequest('turns/send', { threadId, text, idempotencyKey });
  }

  async cancelThread(threadId: string, idempotencyKey: string): Promise<JsonRpcResponse> {
    return this.sendRequest('turns/cancel', { threadId, idempotencyKey });
  }

  async resolveApproval(
    threadId: string,
    approvalId: string,
    decision: 'approved' | 'rejected',
    idempotencyKey: string
  ): Promise<JsonRpcResponse> {
    return this.sendRequest('approvals/resolve', { threadId, approvalId, decision, idempotencyKey });
  }

  async answerQuestion(
    threadId: string,
    questionId: string,
    answer: unknown,
    idempotencyKey: string
  ): Promise<JsonRpcResponse> {
    return this.sendRequest('questions/answer', { threadId, questionId, answer, idempotencyKey });
  }

  private sendRequest(method: string, params: Record<string, unknown>): Promise<JsonRpcResponse> {
    if (this.closed) return Promise.reject(new Error('Client closed'));
    const id = randomUUID();
    const message = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, 30000);
      this.pending.set(id, { resolve, reject, timeout });
      this.process.stdin?.write(JSON.stringify(message) + '\n', (err) => {
        if (err) {
          this.pending.delete(id);
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  async dispose(): Promise<void> {
    if (this.closed) return;
    this.process.stdin?.end();
    this.process.kill('SIGTERM');
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    if (!this.process.killed) this.process.kill('SIGKILL');
  }
}