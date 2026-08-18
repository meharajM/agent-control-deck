/**
 * OpenCode Client Tests
 * Tests HTTP API and SSE client behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenCodeClient } from '../opencode-client.js';

describe('OpenCodeClient', () => {
  let client: OpenCodeClient;
  const mockServerInfo = {
    baseUrl: 'http://127.0.0.1:4096',
    authHeader: 'Basic b3BlbmNvZGU6dGVzdA==',
    password: 'test',
  };

  beforeEach(() => {
    client = new OpenCodeClient(mockServerInfo);
    vi.restoreAllMocks();
  });

  describe('healthCheck', () => {
    it('returns true on successful health check', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ healthy: true, version: '1.17.18' }) });
      expect(await client.healthCheck()).toBe(true);
    });

    it('returns false on failed health check', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false });
      expect(await client.healthCheck()).toBe(false);
    });

    it('returns false on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      expect(await client.healthCheck()).toBe(false);
    });
  });

  describe('getVersion', () => {
    it('returns version info', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ healthy: true, version: '1.17.18' }),
      });
      const version = await client.getVersion();
      expect(version).toEqual({ healthy: true, version: '1.17.18' });
    });

    it('returns null on error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('error'));
      const version = await client.getVersion();
      expect(version).toBeNull();
    });
  });

  describe('createSession', () => {
    it('creates session with working directory', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'sess-123', status: 'running' }),
      });

      const session = await client.createSession('/home/user/project');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:4096/api/session',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: mockServerInfo.authHeader }),
          body: JSON.stringify({ location: { directory: '/home/user/project' } }),
        })
      );
      expect(session.id).toBe('sess-123');
    });
  });

  describe('getSession', () => {
    it('returns session on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'sess-123', status: 'running' }),
      });

      const session = await client.getSession('sess-123');
      expect(session?.id).toBe('sess-123');
    });

    it('returns null on 404', async () => {
      const error = new Error('Not Found') as Error & { status: number };
      error.status = 404;
      global.fetch = vi.fn().mockRejectedValue(error);

      const session = await client.getSession('unknown');
      expect(session).toBeNull();
    });

    it('throws on other errors', async () => {
      const error = new Error('Server Error') as Error & { status: number };
      error.status = 500;
      global.fetch = vi.fn().mockRejectedValue(error);

      await expect(client.getSession('sess-123')).rejects.toThrow();
    });
  });

  describe('sendPrompt', () => {
    it('sends prompt with correct payload', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });

      await client.sendPrompt('sess-123', 'Write a test');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:4096/api/session/sess-123/prompt',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: mockServerInfo.authHeader }),
          body: expect.stringContaining('Write a test'),
        })
      );
    });
  });

  describe('respondToPermission', () => {
    it('responds to permission with messageID', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });

      await client.respondToPermission('sess-123', 'perm-456', 'allow');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:4096/api/session/sess-123/permission/perm-456/reply',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reply: 'once' }),
        })
      );
    });
  });

  describe('abortSession', () => {
    it('aborts session', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });

      await client.abortSession('sess-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:4096/api/session/sess-123/interrupt',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getDiff', () => {
    it('returns diff as text', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('diff content'),
      });

      const diff = await client.getDiff('sess-123');
      expect(diff).toBe('diff content');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:4096/api/session/sess-123/diff',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: mockServerInfo.authHeader }),
        }),
      );
    });
  });

  describe('EventSource handling', () => {
    beforeEach(() => {
      // Mock fetch for SSE connection
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true }),
          }),
        },
      });
    });

    it('connectEvents does not throw when fetch is available', () => {
      expect(() => client.connectEvents()).not.toThrow();
    });

    it('disconnectEvents does not throw', () => {
      client.connectEvents();
      expect(() => client.disconnectEvents()).not.toThrow();
    });
  });
});
