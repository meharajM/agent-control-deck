import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ConformanceAdapter, AdapterEvent, ReconcileResult } from './types.js';

export function describeReconcile(adapterFactory: () => Promise<ConformanceAdapter>): void {
  describe('7. Runtime Restart & 8. Bridge Restart (Reconciliation)', () => {
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

    it('simulate: dispose adapter, create new adapter, reconcile(sessionId) returns { sessionExists: true, state } if session exists', async () => {
      const sessionId = await adapter.startSession({});

      await waitForEvent(adapter, 'session.created', sessionId, 1000);
      await waitForEvent(adapter, 'session.started', sessionId, 1000);

      await adapter.dispose();

      adapter = await adapterFactory();
      events.length = 0;
      adapter.on('session_event', (e) => events.push(e));

      const result: ReconcileResult = await adapter.reconcile(sessionId);

      expect(result.sessionExists).toBe(true);
      expect(result.state).toBeDefined();
    });

    it('reconcile() returns { sessionExists: false } if session gone', async () => {
      const fakeSessionId = 'non-existent-session-id';

      const result: ReconcileResult = await adapter.reconcile(fakeSessionId);

      expect(result.sessionExists).toBe(false);
    });

    it('after reconcile(), adapter state matches runtime state', async () => {
      const sessionId = await adapter.startSession({});

      await waitForEvent(adapter, 'session.created', sessionId, 1000);

      const result: ReconcileResult = await adapter.reconcile(sessionId);

      expect(result.sessionExists).toBe(true);
      expect(result.state).toBeDefined();

      const recreatedAdapter = await adapterFactory();
      recreatedAdapter.on('session_event', (e) => events.push(e));

      const result2: ReconcileResult = await recreatedAdapter.reconcile(sessionId);

      expect(result2.sessionExists).toBe(result.sessionExists);
      expect(result2.state).toBe(result.state);

      await recreatedAdapter.dispose();
    });

    it('bridge restart: reconcile after adapter restart returns consistent state', async () => {
      const sessionId = await adapter.startSession({});

      await waitForEvent(adapter, 'session.created', sessionId, 1000);

      await adapter.dispose();

      const newAdapter = await adapterFactory();
      newAdapter.on('session_event', (e) => events.push(e));

      const result: ReconcileResult = await newAdapter.reconcile(sessionId);

      expect(result.sessionExists).toBe(true);
      expect(result.state).toBeDefined();

      await newAdapter.dispose();
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