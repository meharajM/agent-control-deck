import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ConformanceAdapter, ProbeResult } from './types.js';

export function describeProbe(adapterFactory: () => Promise<ConformanceAdapter>): void {
  describe('1. Probe/Start/Stop', () => {
    let adapter: ConformanceAdapter;

    beforeEach(async () => {
      adapter = await adapterFactory();
    });

    afterEach(async () => {
      await adapter.dispose();
    });

    it('probe() returns { available: true, version }', async () => {
      const result: ProbeResult = await adapter.probe();
      expect(result.available).toBe(true);
      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
      expect(result.version!.length).toBeGreaterThan(0);
    });

    it('startSession({}) returns a session ID', async () => {
      const sessionId = await adapter.startSession({});
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('dispose() cleans up without throwing', async () => {
      await adapter.startSession({});
      await expect(adapter.dispose()).resolves.not.toThrow();
    });

    it('dispose() is safe to call multiple times', async () => {
      await adapter.startSession({});
      await adapter.dispose();
      await expect(adapter.dispose()).resolves.not.toThrow();
    });
  });
}