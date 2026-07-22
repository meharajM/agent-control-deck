import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ConformanceAdapter, AdapterEvent } from './types.js';

export function describeDuplicateIdempotency(adapterFactory: () => Promise<ConformanceAdapter>): void {
  describe('9. Duplicate Command (idempotency)', () => {
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

    it('sendInstruction twice with same idempotency key is no-op', async () => {
      const sessionId = await adapter.startSession({});

      await adapter.sendInstruction(sessionId, 'first instruction', 'idem-send-1');
      const firstCount = events.filter(
        (e) => e.type === 'instruction.accepted' && e.sessionId === sessionId
      ).length;

      await adapter.sendInstruction(sessionId, 'second instruction', 'idem-send-1');
      const secondCount = events.filter(
        (e) => e.type === 'instruction.accepted' && e.sessionId === sessionId
      ).length;

      expect(secondCount).toBe(firstCount);
    });

    it('cancelSession twice with same idempotency key is no-op', async () => {
      const sessionId = await adapter.startSession({});

      await adapter.cancelSession(sessionId, 'idem-cancel-1');
      const firstCount = events.filter(
        (e) => e.type === 'session.cancelled' && e.sessionId === sessionId
      ).length;

      await adapter.cancelSession(sessionId, 'idem-cancel-1');
      const secondCount = events.filter(
        (e) => e.type === 'session.cancelled' && e.sessionId === sessionId
      ).length;

      expect(secondCount).toBe(firstCount);
    });

    it('resolveApproval twice with same idempotency key is no-op', async () => {
      const sessionId = await adapter.startSession({});

      const approvalRequested = new Promise<AdapterEvent>((resolve) => {
        const handler = (e: AdapterEvent) => {
          if (e.type === 'approval.requested' && e.sessionId === sessionId) {
            adapter.off('session_event', handler);
            resolve(e);
          }
        };
        adapter.on('session_event', handler);
      });

      const approvalEvent = await Promise.race([
        approvalRequested,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
      ]);

      const approvalPayload = approvalEvent.payload as { approvalId: string };

      await adapter.resolveApproval(
        sessionId,
        approvalPayload.approvalId,
        'approved',
        'idem-approval-1'
      );
      const firstCount = events.filter(
        (e) => e.type === 'approval.resolved' && e.sessionId === sessionId
      ).length;

      await adapter.resolveApproval(
        sessionId,
        approvalPayload.approvalId,
        'rejected',
        'idem-approval-1'
      );
      const secondCount = events.filter(
        (e) => e.type === 'approval.resolved' && e.sessionId === sessionId
      ).length;

      expect(secondCount).toBe(firstCount);
    });

    it('answerQuestion twice with same idempotency key is no-op', async () => {
      const sessionId = await adapter.startSession({});

      const questionRequested = new Promise<AdapterEvent>((resolve) => {
        const handler = (e: AdapterEvent) => {
          if (e.type === 'question.requested' && e.sessionId === sessionId) {
            adapter.off('session_event', handler);
            resolve(e);
          }
        };
        adapter.on('session_event', handler);
      });

      const questionEvent = await Promise.race([
        questionRequested,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
      ]);

      const questionPayload = questionEvent.payload as { questionId: string };

      await adapter.answerQuestion(
        sessionId,
        questionPayload.questionId,
        'answer 1',
        'idem-question-1'
      );
      const firstCount = events.filter(
        (e) => e.type === 'question.answered' && e.sessionId === sessionId
      ).length;

      await adapter.answerQuestion(
        sessionId,
        questionPayload.questionId,
        'answer 2',
        'idem-question-1'
      );
      const secondCount = events.filter(
        (e) => e.type === 'question.answered' && e.sessionId === sessionId
      ).length;

      expect(secondCount).toBe(firstCount);
    });
  });
}