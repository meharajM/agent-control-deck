import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ConformanceAdapter, AdapterEvent } from './types.js';

export function describeInstructionFlow(adapterFactory: () => Promise<ConformanceAdapter>): void {
  describe('3. Send and Stream', () => {
    let adapter: ConformanceAdapter;
    const events: AdapterEvent[] = [];

    beforeEach(async () => {
      adapter = await adapterFactory();
      events.length = 0;
      adapter.on('session_event', (e) => events.push(e));
    });

    afterEach(async () => {
      adapter.off('session_event', () => {});
      await adapter.dispose();
    });

    it('sendInstruction() emits instruction.accepted then session.completed or approval.requested', async () => {
      const sessionId = await adapter.startSession({});

      const idempotencyKey = 'test-idem-key-1';
      await adapter.sendInstruction(sessionId, 'test instruction', idempotencyKey);

      const accepted = events.find(
        (e) => e.type === 'instruction.accepted' && e.sessionId === sessionId
      );
      expect(accepted).toBeDefined();

      const completedOrApproval = events.find(
        (e) =>
          (e.type === 'session.completed' || e.type === 'approval.requested') &&
          e.sessionId === sessionId
      );
      expect(completedOrApproval).toBeDefined();
    });

    it('idempotency key is honored - duplicate sendInstruction with same key is no-op', async () => {
      const sessionId = await adapter.startSession({});

      const idempotencyKey = 'test-idem-key-2';
      await adapter.sendInstruction(sessionId, 'test instruction', idempotencyKey);

      const eventsAfterFirst = events.filter(
        (e) => e.sessionId === sessionId && e.type === 'instruction.accepted'
      ).length;

      await adapter.sendInstruction(sessionId, 'test instruction again', idempotencyKey);

      const eventsAfterSecond = events.filter(
        (e) => e.sessionId === sessionId && e.type === 'instruction.accepted'
      ).length;

      expect(eventsAfterSecond).toBe(eventsAfterFirst);
    });

    it('different idempotency keys produce separate accepted events', async () => {
      const sessionId = await adapter.startSession({});

      await adapter.sendInstruction(sessionId, 'first', 'key-1');
      await adapter.sendInstruction(sessionId, 'second', 'key-2');

      const acceptedEvents = events.filter(
        (e) => e.sessionId === sessionId && e.type === 'instruction.accepted'
      );
      expect(acceptedEvents.length).toBe(2);
    });
  });
}