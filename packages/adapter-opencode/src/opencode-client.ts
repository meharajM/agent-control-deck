/** HTTP and SSE client for the OpenCode 1.17.x server API. */

import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { ServerInfo } from './server-manager.js';

export interface OpenCodeSession {
  id: string;
  status?: 'running' | 'idle' | 'completed' | 'error';
  workingDirectory?: string;
  location?: { directory: string; workspaceID?: string };
  title?: string;
}

export interface OpenCodeMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SessionPromptParams {
  id?: string;
  prompt: { text: string };
  delivery: 'steer' | 'queue';
  resume: boolean;
}

export class OpenCodeClient extends EventEmitter {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private abortController: AbortController | undefined;

  constructor(serverInfo: ServerInfo) {
    super();
    this.baseUrl = serverInfo.baseUrl;
    this.authHeader = serverInfo.authHeader;
  }

  connectEvents(): void {
    this.disconnectEvents();
    const controller = new AbortController();
    this.abortController = controller;

    void fetch(`${this.baseUrl}/api/event`, {
      headers: { Authorization: this.authHeader, Accept: 'text/event-stream' },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok || !response.body) throw new Error(`SSE connection failed: ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const records = buffer.split(/\r?\n\r?\n/);
          buffer = records.pop() ?? '';
          records.forEach((record) => this.emitSseRecord(record));
          if (done) {
            if (buffer.trim()) this.emitSseRecord(buffer);
            break;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') this.emitClientError(error);
      }
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name !== 'AbortError') this.emitClientError(error);
    });
  }

  disconnectEvents(): void {
    this.abortController?.abort();
    this.abortController = undefined;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.request<{ healthy?: boolean }>('/global/health');
      return health.healthy === true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<{ version: string } | null> {
    try {
      return await this.request<{ version: string }>('/global/health');
    } catch {
      return null;
    }
  }

  async createSession(workingDirectory = process.cwd()): Promise<OpenCodeSession> {
    return this.request<OpenCodeSession>('/api/session', {
      method: 'POST',
      body: JSON.stringify({ location: { directory: workingDirectory } }),
    });
  }

  async getSession(sessionId: string): Promise<OpenCodeSession | null> {
    try {
      return await this.request<OpenCodeSession>(`/api/session/${encodeURIComponent(sessionId)}`);
    } catch (error) {
      if (getStatus(error) === 404) return null;
      throw error;
    }
  }

  async listSessions(directory?: string): Promise<OpenCodeSession[]> {
    const query = directory ? `?directory=${encodeURIComponent(directory)}` : '';
    return this.request<OpenCodeSession[]>(`/api/session${query}`);
  }

  async sendPrompt(sessionId: string, text: string, idempotencyKey?: string): Promise<void> {
    const params: SessionPromptParams = {
      prompt: { text },
      delivery: 'queue',
      resume: true,
    };
    if (idempotencyKey) params.id = createMessageId(idempotencyKey);
    await this.request(`/api/session/${encodeURIComponent(sessionId)}/prompt`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async respondToPermission(sessionId: string, permissionId: string, decision: string): Promise<void> {
    const reply = normalizePermissionReply(decision);
    await this.request(
      `/api/session/${encodeURIComponent(sessionId)}/permission/${encodeURIComponent(permissionId)}/reply`,
      { method: 'POST', body: JSON.stringify({ reply }) },
    );
  }

  async answerQuestion(sessionId: string, questionId: string, answers: string[][]): Promise<void> {
    await this.request(
      `/api/session/${encodeURIComponent(sessionId)}/question/${encodeURIComponent(questionId)}/reply`,
      { method: 'POST', body: JSON.stringify({ answers }) },
    );
  }

  async abortSession(sessionId: string): Promise<void> {
    await this.request(`/api/session/${encodeURIComponent(sessionId)}/interrupt`, { method: 'POST' });
  }

  async getMessages(sessionId: string): Promise<OpenCodeMessage[]> {
    return this.request<OpenCodeMessage[]>(`/api/session/${encodeURIComponent(sessionId)}/message`);
  }

  async getDiff(sessionId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/session/${encodeURIComponent(sessionId)}/diff`, {
      headers: { Authorization: this.authHeader },
    });
    if (!response.ok) throw new Error(`OpenCode API error ${response.status}: ${await response.text().catch(() => 'Unknown error')}`);
    const body = await response.text();
    return body === '[]' ? '' : body;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: this.authHeader, ...options.headers },
    });
    if (!response.ok) {
      const error = new Error(`OpenCode API error ${response.status}: ${await response.text().catch(() => 'Unknown error')}`) as Error & { status: number };
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return undefined as T;
    const payload = await response.json() as unknown;
    return isDataEnvelope(payload) ? payload.data as T : payload as T;
  }

  private emitSseRecord(record: string): void {
    const data = record.split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) return;
    try {
      this.emit('event', JSON.parse(data) as OpenCodeEvent);
    } catch {
      // Ignore malformed optional extension events.
    }
  }

  private emitClientError(error: Error): void {
    if (this.listenerCount('error') > 0) this.emit('error', error);
  }
}

export interface OpenCodeEvent {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  location?: { directory: string; workspaceID?: string };
  durable?: { aggregateID: string; seq: number; version: number };
}

function isDataEnvelope(value: unknown): value is { data: unknown } {
  return typeof value === 'object' && value !== null && 'data' in value;
}

function getStatus(error: unknown): number | undefined {
  return error && typeof error === 'object' && 'status' in error ? Number((error as { status: unknown }).status) : undefined;
}

function createMessageId(value: string): string {
  return `msg_${createHash('sha256').update(value).digest('hex')}`;
}

function normalizePermissionReply(decision: string): 'once' | 'always' | 'reject' {
  switch (decision.toLowerCase()) {
    case 'allow':
    case 'approve':
    case 'approved':
    case 'once':
      return 'once';
    case 'always':
    case 'allow_always':
      return 'always';
    case 'deny':
    case 'denied':
    case 'reject':
    case 'rejected':
      return 'reject';
    default:
      throw new Error(`Unsupported OpenCode permission decision: ${decision}`);
  }
}
