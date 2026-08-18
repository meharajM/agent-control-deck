/**
 * ServerManager Tests
 * Tests OpenCode server process lifecycle management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockProcess } = vi.hoisted(() => ({
  mockProcess: {
    kill: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  },
}));

vi.mock('node:child_process', () => ({
  spawn: vi.fn().mockReturnValue(mockProcess),
}));

import { ServerManager } from '../server-manager.js';

describe('ServerManager', () => {
  let manager: ServerManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ServerManager({ cwd: '/tmp/test' });
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(async () => {
    await manager.stop();
  });

  it('starts server and returns server info', async () => {
    const info = await manager.start();

    expect(info).toMatchObject({
      host: '127.0.0.1',
      authHeader: expect.stringMatching(/^Basic /),
      password: expect.any(String),
    });
    expect(typeof info.port).toBe('number');
    expect(info.port).toBeGreaterThan(0);
    expect(info.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(info.process).toBe(mockProcess);
  });

  it('throws if already running', async () => {
    await manager.start();
    await expect(manager.start()).rejects.toThrow('Server already running');
  });

  it('stops server gracefully', async () => {
    mockProcess.once.mockImplementation((_event: string, cb: any) => {
      if (_event === 'exit') cb(0, 'SIGTERM');
    });

    await manager.start();
    await manager.stop();

    expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    expect(manager.isRunning()).toBe(false);
  });

  it('stop is idempotent', async () => {
    await manager.stop();
    await manager.stop();
  });

  it('getServerInfo returns null before start', () => {
    expect(manager.getServerInfo()).toBeNull();
  });

  it('getServerInfo returns info after start', async () => {
    await manager.start();
    const info = manager.getServerInfo();
    expect(info).not.toBeNull();
    expect(info?.port).toBeGreaterThan(0);
  });

  it('isRunning returns false before start', () => {
    expect(manager.isRunning()).toBe(false);
  });

  it('isRunning returns true after start', async () => {
    await manager.start();
    expect(manager.isRunning()).toBe(true);
  });

  it('attaches to an existing authenticated server without owning its process', async () => {
    const external = new ServerManager({
      serverUrl: 'http://127.0.0.1:4096',
      username: 'agent-deck',
      password: 'persistent-secret',
    });

    const info = await external.start();

    expect(info).toMatchObject({
      baseUrl: 'http://127.0.0.1:4096',
      host: '127.0.0.1',
      port: 4096,
      managed: false,
      username: 'agent-deck',
      password: 'persistent-secret',
      authHeader: expect.stringMatching(/^Basic /),
    });
    expect(info.process).toBeUndefined();

    await external.stop();
    expect(external.isRunning()).toBe(false);
  });
});
