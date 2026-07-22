import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ConformanceAdapter, AdapterEvent } from './types.js';

export function describeCancelFlow(adapterFactory: () => Promise<ConformanceAdapter>): void {
  describe('4. Cancel', () => {
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

    it('cancelSession() emits session.cancelled', async () => {
      const sessionId = await adapter.startSession({});
      await adapter.cancelSession(sessionId, 'cancel-idem-1');

      const cancelled = events.find(
        (e) => e.type === 'session.cancelled' && e.sessionId === sessionId
      );
      expect(cancelled).toBeDefined();
    });

    it('subsequent operations on cancelled session fail gracefully', async () => {
      const sessionId = await adapter.startSession({});
      await adapter.cancelSession(sessionId, 'cancel-idem-2');

      await expect(
        adapter.sendInstruction(sessionId, 'test after cancel', 'idem-1')
      ).rejects.toThrow();

      await expect(
        adapter.cancelSession(sessionId, 'cancel-idem-3')
      ).resolves.not.toThrow();

      const cancelledCount = events.filter(
        (e) => e.type === 'session.cancelled' && e.sessionId === sessionId
      ).length;
      expect(cancelledCount).toBe(1);
    });
  });
}