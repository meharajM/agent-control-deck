import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeAdapter } from '../claude-adapter.js';

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    adapter = new ClaudeAdapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  it('has correct runtime type and version', () => {
    expect(adapter.runtimeType).toBe('claude');
    expect(adapter.adapterVersion).toMatch(/^\d+\.\d+\.\d+-claude$/);
  });

  it('probe returns a result', async () => {
    const result = await adapter.probe();
    expect(typeof result.available).toBe('boolean');
    if (result.available) {
      expect(result.version).toBeDefined();
    } else {
      expect(result.error).toBeDefined();
    }
  });

  it('emits session_event through EventEmitter', async () => {
    const listener = vi.fn();
    adapter.on('session_event', listener);
    // Manually emit to test the channel
    adapter.emit('session_event', {
      type: 'test.event',
      sessionId: 'test',
      payload: {},
      timestamp: new Date().toISOString(),
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('dispose clears sessions and listeners', async () => {
    adapter.on('session_event', vi.fn());
    await adapter.dispose();
    expect(adapter.listenerCount('session_event')).toBe(0);
  });

  it('reconcile returns not_found for unknown session', async () => {
    const result = await adapter.reconcile('unknown-session');
    expect(result.sessionExists).toBe(false);
  });

  it('resolveApproval emits approval.resolved event', async () => {
    const listener = vi.fn();
    adapter.on('session_event', listener);
    await adapter.resolveApproval('sess-1', 'approval-1', 'approved', 'key-1');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'approval.resolved',
        sessionId: 'sess-1',
      })
    );
  });

  it('answerQuestion emits question.answered event', async () => {
    const listener = vi.fn();
    adapter.on('session_event', listener);
    await adapter.answerQuestion('sess-1', 'q-1', 'yes', 'key-1');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'question.answered',
        sessionId: 'sess-1',
      })
    );
  });

  it('cancelSession emits session.cancelled event', async () => {
    const listener = vi.fn();
    adapter.on('session_event', listener);
    await adapter.cancelSession('sess-1', 'key-1');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'session.cancelled',
        sessionId: 'sess-1',
      })
    );
  });
});
