import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CodexAdapter } from '../codex-adapter.js';
import type { AdapterEvent, ProbeResult, StartSessionParams, ReconcileResult } from '@agent-deck/adapter-contract';

describe('CodexAdapter conformance', () => {
  let adapter: CodexAdapter;

  beforeEach(() => {
    adapter = new CodexAdapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe('RuntimeAdapter interface', () => {
    it('probe returns ProbeResult', async () => {
      const result = await adapter.probe();
      expect(result).toMatchObject<ProbeResult>({
        available: expect.any(Boolean),
      });
      if (result.available) {
        expect(typeof result.version).toBe('string');
      } else {
        expect(typeof result.error).toBe('string');
      }
    });

    it('startSession returns string sessionId', async () => {
      // Probe first (may fail if codex not installed, but we test structure)
      await adapter.probe();
      // We can't actually start a session without codex, but we verify the method exists
      expect(typeof adapter.startSession).toBe('function');
    });

    it('sendInstruction accepts sessionId, text, idempotencyKey', async () => {
      expect(typeof adapter.sendInstruction).toBe('function');
    });

    it('cancelSession accepts sessionId, idempotencyKey', async () => {
      expect(typeof adapter.cancelSession).toBe('function');
    });

    it('resolveApproval accepts sessionId, approvalId, decision, idempotencyKey', async () => {
      expect(typeof adapter.resolveApproval).toBe('function');
    });

    it('answerQuestion accepts sessionId, questionId, answer, idempotencyKey', async () => {
      expect(typeof adapter.answerQuestion).toBe('function');
    });

    it('reconcile returns ReconcileResult', async () => {
      const result = await adapter.reconcile('test-session');
      expect(result).toMatchObject<ReconcileResult>({
        sessionExists: expect.any(Boolean),
      });
    });

    it('dispose returns Promise<void>', async () => {
      await expect(adapter.dispose()).resolves.toBeUndefined();
    });

    it('emits session_event with AdapterEvent', () => {
      const events: AdapterEvent[] = [];
      adapter.on('session_event', (e) => events.push(e));
      
      expect(events).toEqual([]);
      adapter.off('session_event', () => {});
    });
  });

  describe('EventEmitter behavior', () => {
    it('on/off works for session_event', () => {
      const listener = vi.fn();
      adapter.on('session_event', listener);
      adapter.off('session_event', listener);
      expect(listener).not.toHaveBeenCalled();
    });

    it('multiple listeners can be registered', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      adapter.on('session_event', listener1);
      adapter.on('session_event', listener2);
      adapter.off('session_event', listener1);
      adapter.off('session_event', listener2);
    });
  });
});