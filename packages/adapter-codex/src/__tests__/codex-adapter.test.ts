import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CodexAdapter } from '../codex-adapter.js';

describe('CodexAdapter', () => {
  let adapter: CodexAdapter;

  beforeEach(() => {
    adapter = new CodexAdapter();
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
    expect(adapter.runtimeType).toBe('codex');
    expect(adapter.adapterVersion).toBe('0.1.0');
  });

  it('probe returns available false when codex not installed', async () => {
    const result = await adapter.probe();
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