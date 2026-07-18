import { describe, it, expect, vi } from 'vitest';
import { FakeAdapter } from '../fake-adapter.js';
import type { AdapterEvent } from '@agent-deck/adapter-contract';

describe('FakeAdapter', () => {
  it('probe returns available', async () => {
    const adapter = new FakeAdapter();
    const result = await adapter.probe();
    expect(result.available).toBe(true);
    expect(result.version).toBe('0.1.0-fake');
    await adapter.dispose();
  });

  it('startSession returns a non-empty session id', async () => {
    const adapter = new FakeAdapter();
    const id = await adapter.startSession({});
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    await adapter.dispose();
  });

  it('fires events in order from scenario', async () => {
    const adapter = new FakeAdapter();
    const received: string[] = [];

    await new Promise<void>((resolve) => {
      adapter.on('session_event', (e: AdapterEvent) => {
        received.push(e.type);
        if (e.type === 'session.completed') resolve();
      });
      void adapter.startSession({});
    });

    expect(received).toEqual([
      'session.started',
      'approval.requested',
      'session.completed',
    ]);
    await adapter.dispose();
  });

  it('reconcile returns sessionExists true for live session', async () => {
    const adapter = new FakeAdapter([]);
    const id = await adapter.startSession({});
    const result = await adapter.reconcile(id);
    expect(result.sessionExists).toBe(true);
    await adapter.dispose();
  });

  it('reconcile returns sessionExists false for unknown session', async () => {
    const adapter = new FakeAdapter();
    const result = await adapter.reconcile('no-such-session');
    expect(result.sessionExists).toBe(false);
    await adapter.dispose();
  });

  it('cancelSession emits session.cancelled event', async () => {
    const adapter = new FakeAdapter([]);
    const id = await adapter.startSession({});
    const listener = vi.fn();
    adapter.on('session_event', listener);
    await adapter.cancelSession(id, 'idem-cancel');
    // setImmediate fires asynchronously
    await new Promise((r) => setImmediate(r));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'session.cancelled', sessionId: id })
    );
    await adapter.dispose();
  });

  it('resolveApproval emits approval.resolved event', async () => {
    const adapter = new FakeAdapter([]);
    const id = await adapter.startSession({});
    const listener = vi.fn();
    adapter.on('session_event', listener);
    await adapter.resolveApproval(id, 'apr-001', 'approved', 'idem-001');
    await new Promise((r) => setImmediate(r));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'approval.resolved',
        sessionId: id,
        payload: expect.objectContaining({ decision: 'approved' }),
      })
    );
    await adapter.dispose();
  });
});
