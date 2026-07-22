/**
 * HTTP + SSE client for OpenCode server API.
 * Handles authentication, session management, and event streaming.
 * // ponytail: minimal wrapper around fetch + EventSource
 */

import { EventEmitter } from 'node:events';
import type { ServerInfo } from './server-manager.js';

export interface OpenCodeSession {
  id: string;
  status: 'running' | 'idle' | 'completed' | 'error';
  workingDirectory?: string;
}

export interface OpenCodeMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SessionChatParams {
  modelID: string;
  parts: Array<{ type: 'text'; text: string }>;
  providerID: string;
  messageID?: string;
  mode?: string;
  system?: string;
  tools?: Record<string, boolean>;
}

/**
 * OpenCode API client with SSE event streaming.
 * Emits 'event' for each parsed SSE message.
 */
export class OpenCodeClient extends EventEmitter {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly defaultModel: string;
  private readonly defaultProvider: string;

  constructor(serverInfo: ServerInfo, defaultModel = 'gpt-4', defaultProvider = 'openai') {
    super();
    this.baseUrl = serverInfo.baseUrl;
    this.authHeader = serverInfo.authHeader;
    this.defaultModel = defaultModel;
    this.defaultProvider = defaultProvider;
  }

  /**
   * Start SSE event stream.
   * Uses fetch-based streaming since EventSource is not available in Node.js.
   * Emits 'event' for each parsed SSE message.
   */
  connectEvents(): void {
    this.connectEventsWithFetch();
  }

  /**
   * Connect to SSE using fetch with custom headers for auth.
   */
  private connectEventsWithFetch(): void {
    const controller = new AbortController();
    const { signal } = controller;

    fetch(`${this.baseUrl}/api/event`, {
      headers: { Authorization: this.authHeader },
      signal,
    })
      .then((response) => {
        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const read = async (): Promise<void> => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n\n');
              buffer = lines.pop() ?? '';
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6)) as OpenCodeEvent;
                    this.emit('event', data);
                  } catch {
                    // Ignore parse errors
                  }
                }
              }
            }
          } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
              this.emit('error', err);
            }
          }
        };

        read();
      })
      .catch((err) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          this.emit('error', err);
        }
      });

    // Store abort controller for cleanup
    (this as unknown as { abortController: AbortController }).abortController = controller;
  }

  /**
   * Close SSE connection.
   */
  disconnectEvents(): void {
    const abortController = (this as unknown as { abortController?: AbortController }).abortController;
    if (abortController) {
      abortController.abort();
    }
  }

  /**
   * Check server health.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        headers: { Authorization: this.authHeader },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get server version info.
   */
  async getVersion(): Promise<{ version: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/version`, {
        headers: { Authorization: this.authHeader },
      });
      if (response.ok) {
        return (await response.json()) as { version: string };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Create a new session.
   */
  async createSession(workingDirectory?: string): Promise<OpenCodeSession> {
    const body: Record<string, unknown> = {};
    if (workingDirectory) body.workingDirectory = workingDirectory;

    return this.request<OpenCodeSession>('/api/session', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get session by ID.
   */
  async getSession(sessionId: string): Promise<OpenCodeSession | null> {
    try {
      return await this.request<OpenCodeSession>(`/api/session/${sessionId}`);
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * List all sessions.
   */
  async listSessions(): Promise<OpenCodeSession[]> {
    return this.request<OpenCodeSession[]>('/api/session');
  }

  /**
   * Send a prompt/instruction to a session.
   */
  async sendPrompt(sessionId: string, text: string): Promise<void> {
    const params: SessionChatParams = {
      modelID: this.defaultModel,
      parts: [{ type: 'text', text }],
      providerID: this.defaultProvider,
    };

    await this.request(`/api/session/${sessionId}/message`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Respond to a permission request.
   * Uses messageID to correlate with the permission prompt.
   */
  async respondToPermission(
    sessionId: string,
    permissionId: string,
    decision: 'allow' | 'deny'
  ): Promise<void> {
    const params: SessionChatParams = {
      modelID: this.defaultModel,
      parts: [{ type: 'text', text: decision }],
      providerID: this.defaultProvider,
      messageID: permissionId,
    };

    await this.request(`/api/session/${sessionId}/message`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Abort a running session.
   */
  async abortSession(sessionId: string): Promise<void> {
    await this.request(`/api/session/${sessionId}/abort`, {
      method: 'POST',
    });
  }

  /**
   * Get messages for a session.
   */
  async getMessages(sessionId: string): Promise<OpenCodeMessage[]> {
    return this.request<OpenCodeMessage[]>(`/api/session/${sessionId}/messages`);
  }

  /**
   * Get diff for a session.
   */
  async getDiff(sessionId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/session/${sessionId}/diff`, {
      headers: { Authorization: this.authHeader },
    });
    return response.text();
  }

  /**
   * Generic authenticated request.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      const error = new Error(`OpenCode API error ${response.status}: ${errorText}`);
      (error as Error & { status: number }).status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}

/**
 * OpenCode SSE event structure.
 */
export interface OpenCodeEvent {
  type: string;
  properties: Record<string, unknown>;
}