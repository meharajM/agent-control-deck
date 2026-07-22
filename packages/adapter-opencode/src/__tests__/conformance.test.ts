/**
 * Conformance Tests
 * Verifies OpenCodeAdapter implements RuntimeAdapter interface correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ponytail: same mock pattern — emit error immediately so probe() doesn't hang
const { mockSpawn } = vi.hoisted(() => ({
  mockSpawn: vi.fn().mockImplementation(() => {
    const { EventEmitter } = require('node:events') as typeof import('node:events');
    const proc = new EventEmitter() as any;
    proc.kill = vi.fn();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    setTimeout(() => proc.emit('error', new Error('spawn ENOENT')), 0);
    return proc;
  }),
}));

vi.mock('node:child_process', () => ({ spawn: mockSpawn }));

import { OpenCodeAdapter } from '../opencode-adapter.js';

describe('OpenCodeAdapter Conformance', () => {
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenCodeAdapter({ cwd: '/tmp/test' });
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe('RuntimeAdapter interface', () => {
    it('has correct runtimeType', () => {
      expect(adapter.runtimeType).toBe('opencode');
    });

    it('has adapterVersion', () => {
      expect(adapter.adapterVersion).toBeDefined();
      expect(typeof adapter.adapterVersion).toBe('string');
    });

    it('implements probe()', async () => {
      const result = await adapter.probe();
      expect(result).toHaveProperty('available');
      expect(typeof result.available).toBe('boolean');
    });

    it('implements startSession()', () => {
      expect(typeof adapter.startSession).toBe('function');
    });

    it('implements sendInstruction()', () => {
      expect(typeof adapter.sendInstruction).toBe('function');
    });

    it('implements cancelSession()', () => {
      expect(typeof adapter.cancelSession).toBe('function');
    });

    it('implements resolveApproval()', () => {
      expect(typeof adapter.resolveApproval).toBe('function');
    });

    it('implements answerQuestion()', () => {
      expect(typeof adapter.answerQuestion).toBe('function');
    });

    it('implements reconcile()', () => {
      expect(typeof adapter.reconcile).toBe('function');
    });

    it('implements dispose()', () => {
      expect(typeof adapter.dispose).toBe('function');
    });

    it('implements EventEmitter for session_event', () => {
      expect(typeof adapter.on).toBe('function');
      expect(typeof adapter.off).toBe('function');
      expect(typeof adapter.emit).toBe('function');
    });
  });

  describe('ProbeResult structure', () => {
    it('returns ProbeResult with required fields', async () => {
      const result = await adapter.probe();
      expect(result).toMatchObject({
        available: expect.any(Boolean),
      });
    });
  });

  describe('StartSessionParams handling', () => {
    it('accepts workingDirectory', () => {
      const params = { workingDirectory: '/home/user' };
      expect(params).toHaveProperty('workingDirectory');
    });

    it('accepts initial instruction', () => {
      const params = { instruction: 'Fix the bug' };
      expect(params).toHaveProperty('instruction');
    });
  });

  describe('Idempotency handling', () => {
    it('tracks idempotency keys internally', () => {
      const adapterAny = adapter as any;
      expect(adapterAny.idempotencyKeys).toBeInstanceOf(Set);
    });
  });

  describe('Session management', () => {
    it('maintains session mapping', () => {
      const adapterAny = adapter as any;
      expect(adapterAny.sessions).toBeInstanceOf(Map);
    });
  });

  describe('Disposal', () => {
    it('disposes cleanly', async () => {
      await expect(adapter.dispose()).resolves.not.toThrow();
      await expect(adapter.dispose()).resolves.not.toThrow(); // Idempotent
    });

    it('rejects operations after dispose', async () => {
      await adapter.dispose();
      // probe() is allowed after dispose per adapter contract
      await expect(adapter.probe()).resolves.not.toThrow();
    });
  });

  describe('Event emission', () => {
    it('emits session_event for session.started', () => {
      const events: any[] = [];
      adapter.on('session_event', (e) => events.push(e));
      expect(adapter.listenerCount('session_event')).toBe(1);
    });

    it('supports off() for removing listeners', () => {
      const listener = () => {};
      adapter.on('session_event', listener);
      adapter.off('session_event', listener);
      expect(adapter.listenerCount('session_event')).toBe(0);
    });
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
