import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ConformanceAdapter, AdapterEvent } from './types.js';

export function describeSessionLifecycle(adapterFactory: () => Promise<ConformanceAdapter>): void {
  describe('2. Session List/Create/Get', () => {
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

    it('multiple startSession() calls create independent sessions', async () => {
      const sessionId1 = await adapter.startSession({});
      const sessionId2 = await adapter.startSession({ workingDirectory: '/tmp/test' });
      const sessionId3 = await adapter.startSession({ instruction: 'test' });

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId2).not.toBe(sessionId3);
      expect(sessionId1).not.toBe(sessionId3);
    });

    it('sessions emit session.started or session.created events', async () => {
      await adapter.startSession({});

      const sessionEvent = events.find(
        (e) => e.type === 'session.started' || e.type === 'session.created'
      );
      expect(sessionEvent).toBeDefined();
      expect(sessionEvent!.sessionId).toBeDefined();
    });

    it('sessions emit distinct events per session', async () => {
      const sessionId1 = await adapter.startSession({});
      const sessionId2 = await adapter.startSession({});

      const session1Events = events.filter((e) => e.sessionId === sessionId1);
      const session2Events = events.filter((e) => e.sessionId === sessionId2);

      expect(session1Events.length).toBeGreaterThan(0);
      expect(session2Events.length).toBeGreaterThan(0);
      expect(session1Events.every((e) => e.sessionId === sessionId1)).toBe(true);
      expect(session2Events.every((e) => e.sessionId === sessionId2)).toBe(true);
    });
  });
}