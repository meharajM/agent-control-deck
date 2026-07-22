import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ConformanceAdapter, AdapterEvent } from './types.js';

export function describeQuestionFlow(adapterFactory: () => Promise<ConformanceAdapter>): void {
  describe('6. Question Response', () => {
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

    it('answerQuestion() works for free-text', async () => {
      const sessionId = await adapter.startSession({});

      await waitForEvent(adapter, 'question.asked', sessionId, 2000);

      const questionEvent = events.find(
        (e) => e.type === 'question.asked' && e.sessionId === sessionId
      );
      expect(questionEvent).toBeDefined();

      const questionId = (questionEvent!.payload as Record<string, unknown>).questionId as string;
      await adapter.answerQuestion(sessionId, questionId, 'free text answer', 'q-idem-1');

      const answered = events.find(
        (e) =>
          e.type === 'question.answered' &&
          e.sessionId === sessionId &&
          (e.payload as Record<string, unknown>).questionId === questionId
      );
      expect(answered).toBeDefined();
    });

    it('answerQuestion() works for multiple-choice', async () => {
      const sessionId = await adapter.startSession({});

      await waitForEvent(adapter, 'question.asked', sessionId, 2000);

      const questionEvent = events.find(
        (e) => e.type === 'question.asked' && e.sessionId === sessionId
      );
      const questionId = (questionEvent!.payload as Record<string, unknown>).questionId as string;

      await adapter.answerQuestion(sessionId, questionId, { choice: 'option-a' }, 'q-idem-2');

      const answered = events.find(
        (e) =>
          e.type === 'question.answered' &&
          e.sessionId === sessionId &&
          (e.payload as Record<string, unknown>).questionId === questionId
      );
      expect(answered).toBeDefined();
    });

    function waitForEvent(
      adapter: ConformanceAdapter,
      type: string,
      sessionId: string,
      timeoutMs: number
    ): Promise<AdapterEvent | undefined> {
      return new Promise((resolve) => {
        const existing = events.find(
          (e) => e.type === type && e.sessionId === sessionId
        );
        if (existing) {
          resolve(existing);
          return;
        }

        const timeout = setTimeout(() => {
          adapter.off('session_event', handler);
          resolve(undefined);
        }, timeoutMs);

        const handler = (e: AdapterEvent) => {
          if (e.type === type && e.sessionId === sessionId) {
            clearTimeout(timeout);
            adapter.off('session_event', handler);
            resolve(e);
          }
        };
        adapter.on('session_event', handler);
      });
    }
  });
}