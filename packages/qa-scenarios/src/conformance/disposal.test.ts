import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ConformanceAdapter, AdapterEvent } from './types.js';

export function describeDisposal(adapterFactory: () => Promise<ConformanceAdapter>): void {
  describe('13. Backpressure/Rate Limit & Disposal', () => {
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

    it('rapid sendInstruction() calls do not crash adapter', async () => {
      const sessionId = await adapter.startSession({});

      const promises = Array.from({ length: 50 }, (_, i) =>
        adapter.sendInstruction(sessionId, `rapid instruction ${i}`, `rapid-idem-${i}`)
      );

      await Promise.all(promises);

      const acceptedCount = events.filter(
        (e) => e.type === 'instruction.accepted' && e.sessionId === sessionId
      ).length;
      expect(acceptedCount).toBe(50);
    });

    it('dispose() cleans up resources', async () => {
      const sessionId = await adapter.startSession({});
      await adapter.dispose();

      await expect(adapter.startSession({})).rejects.toThrow();
      await expect(adapter.sendInstruction(sessionId, 'test', 'key')).rejects.toThrow();
    });

    it('dispose() is safe to call multiple times', async () => {
      await adapter.startSession({});
      await adapter.dispose();
      await expect(adapter.dispose()).resolves.not.toThrow();
    });
  });
}