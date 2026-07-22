import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestHarness } from '../harness.js';
import { ScenarioRunner, runPerformanceTest } from '../runner.js';
import { happyPath } from '../index.js';

let harness: TestHarness;

beforeEach(async () => {
  harness = new TestHarness();
  await harness.setup();
});

afterEach(async () => {
  await harness.teardown();
});

describe('Performance: snapshot throughput', () => {
  it('100 sessions snapshot completes under 5 seconds', async () => {
    await harness.connect();

    const sessionIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const sid = await harness.startAdapterSession();
      sessionIds.push(sid);
    }

    const start = Date.now();
    for (const sid of sessionIds) {
      harness.assertReplayEqualsSnapshot(sid);
    }
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
  }, 10000);
});

describe('Performance: reconnect endurance', () => {
  it('1000 reconnect cycles without unbounded memory growth', async () => {
    await harness.connect();
    await harness.startAdapterSession();

    const memoryBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      await harness.disconnect();
      await harness.reconnect();
    }

    const memoryAfter = process.memoryUsage().heapUsed;
    const growth = memoryAfter - memoryBefore;

    // Allow 20MB growth for 1000 cycles in the in-memory harness.
    expect(growth).toBeLessThan(20 * 1024 * 1024);
  }, 120000);
});

describe('Performance: happy path timing', () => {
  it('happy path completes in reasonable time', async () => {
    await harness.connect();
    const runner = new ScenarioRunner(harness);
    const start = Date.now();
    const result = await runner.run(happyPath);
    const elapsed = Date.now() - start;

    expect(result.passed).toBe(true);
    expect(elapsed).toBeLessThan(10000);
  }, 15000);
});

describe('Performance: memory stability', () => {
  it('repeated operations do not leak memory', async () => {
    await harness.connect();

    const memorySamples: number[] = [];
    for (let i = 0; i < 50; i++) {
      await harness.startAdapterSession();
      memorySamples.push(process.memoryUsage().heapUsed);
    }

    // Memory should not grow unboundedly
    const first10 = memorySamples.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const last10 = memorySamples.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const growthPercent = ((last10 - first10) / first10) * 100;

    // Allow 50% growth over 50 iterations
    expect(growthPercent).toBeLessThan(50);
  }, 30000);
});

describe('Performance: burst event throughput', () => {
  it('collects at least 1000 normalized events without data loss', async () => {
    await harness.connect();

    const result = await runPerformanceTest(harness, {
      eventCount: 1000,
      sessionCount: 100,
    });

    expect(result.passed).toBe(true);
    expect(result.eventCount).toBeGreaterThanOrEqual(1000);
    expect(result.eventsPerSecond).toBeGreaterThan(0);
  }, 30000);
});
