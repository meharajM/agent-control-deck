/**
 * OpenCode Adapter Tests
 * Tests adapter interface contract compliance and OpenCode-specific behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ponytail: mock child_process so probe() doesn't hang or spawn real opencode
// The mock must emit 'error' immediately so probe() rejects instead of waiting.
const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn().mockImplementation((_cmd: string, _args: string[]) => {
    const { EventEmitter } = require('node:events') as typeof import('node:events');
    const proc = new EventEmitter() as any;
    proc.kill = vi.fn();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    // Emit error synchronously so probe() rejects immediately
    setTimeout(() => proc.emit('error', new Error('spawn ENOENT')), 0);
    return proc;
  }),
}));

vi.mock('node:child_process', () => ({ spawn: mockSpawn }));

import { OpenCodeAdapter } from '../opencode-adapter.js';

describe('OpenCodeAdapter', () => {
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenCodeAdapter({ cwd: '/tmp/test' });
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  it('implements RuntimeAdapter interface', () => {
    expect(typeof adapter.probe).toBe('function');
    expect(typeof adapter.startSession).toBe('function');
    expect(typeof adapter.sendInstruction).toBe('function');
    expect(typeof adapter.cancelSession).toBe('function');
    expect(typeof adapter.resolveApproval).toBe('function');
    expect(typeof adapter.answerQuestion).toBe('function');
    expect(typeof adapter.reconcile).toBe('function');
    expect(typeof adapter.dispose).toBe('function');
    expect(typeof adapter.on).toBe('function');
    expect(typeof adapter.off).toBe('function');
  });

  it('has correct runtimeType and adapterVersion', () => {
    expect(adapter.runtimeType).toBe('opencode');
    expect(adapter.adapterVersion).toBeDefined();
    expect(typeof adapter.adapterVersion).toBe('string');
  });

  it('probe returns ProbeResult structure', async () => {
    const result = await adapter.probe();
    expect(result).toHaveProperty('available');
    expect(typeof result.available).toBe('boolean');
    if (!result.available) {
      expect(result.error).toBeDefined();
    }
  });

  it('dispose is safe to call multiple times', async () => {
    await adapter.dispose();
    await adapter.dispose(); // should not throw
  });

  it('reconcile returns sessionExists false for unknown session', async () => {
    const result = await adapter.reconcile('unknown-session');
    expect(result.sessionExists).toBe(false);
  });
});

describe('Adapter Contract Compliance', () => {
  it('exports createOpenCodeAdapter factory', async () => {
    const { createOpenCodeAdapter } = await import('../opencode-adapter.js');
    expect(typeof createOpenCodeAdapter).toBe('function');
  });

  it('factory returns RuntimeAdapter', async () => {
    const { createOpenCodeAdapter } = await import('../opencode-adapter.js');
    const adapter = createOpenCodeAdapter();
    expect(adapter).toHaveProperty('runtimeType', 'opencode');
    expect(adapter).toHaveProperty('adapterVersion');
    expect(typeof adapter.probe).toBe('function');
    await adapter.dispose();
  });
});
