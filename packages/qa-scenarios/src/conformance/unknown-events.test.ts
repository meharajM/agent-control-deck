import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ConformanceAdapter, AdapterEvent } from './types.js';

export function describeUnknownEvents(adapterFactory: () => Promise<ConformanceAdapter>): void {
  describe('12. Unknown Event (fail closed per UCP §17)', () => {
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

    it('adapter emits unknown event type - bridge ignores gracefully', async () => {
      const sessionId = await adapter.startSession({});

      const unknownEvent: AdapterEvent = {
        type: 'unknown.custom.event',
        sessionId,
        payload: { some: 'data' },
        timestamp: new Date().toISOString(),
      };

      (adapter as unknown as { emit: (event: string, data: AdapterEvent) => void }).emit(
        'session_event',
        unknownEvent
      );

      const accepted = events.some(
        (e) => e.type === 'unknown.custom.event' && e.sessionId === sessionId
      );
      expect(accepted).toBe(false);
    });

    it('unknown approval type fails closed - no crash', async () => {
      const sessionId = await adapter.startSession({});

      const unknownApprovalEvent: AdapterEvent = {
        type: 'approval.requested',
        sessionId,
        payload: {
          approvalId: 'unknown-1',
          category: 'unknown_category',
          risk: 'critical',
          title: 'Unknown Approval',
        },
        timestamp: new Date().toISOString(),
      };

      (adapter as unknown as { emit: (event: string, data: AdapterEvent) => void }).emit(
        'session_event',
        unknownApprovalEvent
      );

      await expect(
        adapter.resolveApproval(sessionId, 'unknown-1', 'approved', 'key-1')
      ).rejects.toThrow();

      const resolved = events.find(
        (e) => e.type === 'approval.resolved' && e.sessionId === sessionId
      );
      expect(resolved).toBeUndefined();
    });
  });
}