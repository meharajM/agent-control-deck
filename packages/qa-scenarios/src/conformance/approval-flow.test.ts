import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ConformanceAdapter, AdapterEvent } from './types.js';

export function describeApprovalFlow(adapterFactory: () => Promise<ConformanceAdapter>): void {
  describe('5. Approval Allow/Deny', () => {
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

    it('when adapter emits approval.requested, resolveApproval(decision) resolves it', async () => {
      const sessionId = await adapter.startSession({});

      await waitForEvent(adapter, 'approval.requested', sessionId, 2000);

      const approvalEvent = events.find(
        (e) => e.type === 'approval.requested' && e.sessionId === sessionId
      );
      expect(approvalEvent).toBeDefined();

      const approvalId = (approvalEvent!.payload as Record<string, unknown>).approvalId as string;
      await adapter.resolveApproval(sessionId, approvalId, 'approved', 'approve-idem-1');

      const resolved = events.find(
        (e) =>
          e.type === 'approval.resolved' &&
          e.sessionId === sessionId &&
          (e.payload as Record<string, unknown>).approvalId === approvalId &&
          (e.payload as Record<string, unknown>).decision === 'approved'
      );
      expect(resolved).toBeDefined();
    });

    it('decision: "approved" works', async () => {
      const sessionId = await adapter.startSession({});

      await waitForEvent(adapter, 'approval.requested', sessionId, 2000);

      const approvalEvent = events.find(
        (e) => e.type === 'approval.requested' && e.sessionId === sessionId
      );
      const approvalId = (approvalEvent!.payload as Record<string, unknown>).approvalId as string;

      await adapter.resolveApproval(sessionId, approvalId, 'approved', 'approve-idem-2');

      const resolved = events.find(
        (e) =>
          e.type === 'approval.resolved' &&
          (e.payload as Record<string, unknown>).decision === 'approved'
      );
      expect(resolved).toBeDefined();
    });

    it('decision: "rejected" works', async () => {
      const sessionId = await adapter.startSession({});

      await waitForEvent(adapter, 'approval.requested', sessionId, 2000);

      const approvalEvent = events.find(
        (e) => e.type === 'approval.requested' && e.sessionId === sessionId
      );
      const approvalId = (approvalEvent!.payload as Record<string, unknown>).approvalId as string;

      await adapter.resolveApproval(sessionId, approvalId, 'rejected', 'reject-idem-1');

      const resolved = events.find(
        (e) =>
          e.type === 'approval.resolved' &&
          (e.payload as Record<string, unknown>).decision === 'rejected'
      );
      expect(resolved).toBeDefined();
    });

    it('compare-and-set via version works (simulate conflict)', async () => {
      const sessionId = await adapter.startSession({});

      await waitForEvent(adapter, 'approval.requested', sessionId, 2000);

      const approvalEvent = events.find(
        (e) => e.type === 'approval.requested' && e.sessionId === sessionId
      );
      const approvalId = (approvalEvent!.payload as Record<string, unknown>).approvalId as string;

      const result1 = await adapter.resolveApproval(sessionId, approvalId, 'approved', 'cas-1');
      expect(result1).toBeUndefined();

      await expect(
        adapter.resolveApproval(sessionId, approvalId, 'rejected', 'cas-2')
      ).rejects.toThrow();
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