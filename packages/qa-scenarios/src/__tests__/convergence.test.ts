import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TestHarness } from '../harness.js';
import { ScenarioRunner } from '../runner.js';
import {
  assertReplayEqualsSnapshot,
  assertIdempotent,
  assertVersionMonotonic,
  assertNoDuplicateDispatch,
  assertConverged,
} from '../convergence.js';
import { happyPath, reconnect, duplicateCommand } from '../index.js';

let harness: TestHarness;

beforeEach(async () => {
  harness = new TestHarness();
  await harness.setup();
});

afterEach(async () => {
  await harness.teardown();
});

describe('Convergence: replay = snapshot', () => {
  it('happy path: replay produces same state as snapshot', async () => {
    await harness.connect();
    const runner = new ScenarioRunner(harness);
    await runner.run(happyPath);

    const sessionId = harness.getSessionId();
    expect(sessionId).not.toBeNull();

    const result = harness.assertReplayEqualsSnapshot(sessionId!);
    expect(result.equal).toBe(true);
    expect(result.replayEvents).toBeGreaterThan(0);
  });

  it('reconnect scenario: state converges after disconnect/reconnect', async () => {
    await harness.connect();
    const runner = new ScenarioRunner(harness);
    await runner.run(reconnect);

    const sessionId = harness.getSessionId();
    expect(sessionId).not.toBeNull();

    const result = harness.assertReplayEqualsSnapshot(sessionId!);
    expect(result.equal).toBe(true);
  });
});

describe('Convergence: idempotency', () => {
  it('applying the same event twice produces identical state', () => {
    const event = {
      sequence: 1,
      eventId: randomUUID(),
      sessionId: 'test',
      type: 'session.updated',
      payload: { summary: 'Step 1', currentAction: 'Processing' },
      createdAt: new Date().toISOString(),
    };

    interface TestState { summary: string; action: string | null }
    const applyFn = (state: TestState, e: { payload: unknown }) => {
      const p = e.payload as Record<string, unknown>;
      return { ...state, summary: p['summary'] as string, action: p['currentAction'] as string | null };
    };

    const result = assertIdempotent(event, applyFn, { summary: '', action: null });
    expect(result.idempotent).toBe(true);
    expect(result.state1).toEqual(result.state2);
  });

  it('idempotent: session.completed applied twice = same state', () => {
    const event = {
      sequence: 1,
      eventId: randomUUID(),
      sessionId: 'test',
      type: 'session.completed',
      payload: { status: 'completed', summary: 'Done' },
      createdAt: new Date().toISOString(),
    };

    interface TestState { state: string; summary: string }
    const applyFn = (state: TestState, e: { payload: unknown }) => {
      const p = e.payload as Record<string, unknown>;
      return { ...state, state: p['status'] as string, summary: p['summary'] as string };
    };

    const result = assertIdempotent(event, applyFn, { state: 'running', summary: '' });
    expect(result.idempotent).toBe(true);
  });
});

describe('Convergence: version monotonicity', () => {
  it('versions increase monotonically', () => {
    const sessions = [
      { id: 's1', version: 1 },
      { id: 's1', version: 2 },
      { id: 's1', version: 3 },
      { id: 's2', version: 1 },
      { id: 's2', version: 2 },
    ];
    const result = assertVersionMonotonic(sessions);
    expect(result.monotonic).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects version regression', () => {
    const sessions = [
      { id: 's1', version: 2 },
      { id: 's1', version: 1 },
    ];
    const result = assertVersionMonotonic(sessions);
    expect(result.monotonic).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.id).toBe('s1');
  });
});

describe('Convergence: no duplicate dispatch', () => {
  it('unique idempotency keys pass', () => {
    const commands = [
      { idempotencyKey: 'key1', dispatched: true },
      { idempotencyKey: 'key2', dispatched: true },
      { idempotencyKey: 'key3', dispatched: true },
    ];
    const result = assertNoDuplicateDispatch(commands);
    expect(result.unique).toBe(true);
    expect(result.duplicates).toHaveLength(0);
  });

  it('duplicate key detected', () => {
    const commands = [
      { idempotencyKey: 'key1', dispatched: true },
      { idempotencyKey: 'key1', dispatched: true },
    ];
    const result = assertNoDuplicateDispatch(commands);
    expect(result.unique).toBe(false);
    expect(result.duplicates).toEqual(['key1']);
  });
});

describe('Convergence: state convergence', () => {
  it('identical states converge', () => {
    const runtime = { state: 'completed', version: 3 };
    const normalized = { state: 'completed', version: 3 };
    const result = assertConverged(runtime, normalized);
    expect(result.converged).toBe(true);
    expect(result.diffs).toHaveLength(0);
  });

  it('different states do not converge', () => {
    const runtime = { state: 'completed', version: 3 };
    const normalized = { state: 'running', version: 2 };
    const result = assertConverged(runtime, normalized);
    expect(result.converged).toBe(false);
    expect(result.diffs).toContain('state');
    expect(result.diffs).toContain('version');
  });

  it('ignored keys are excluded from comparison', () => {
    const runtime = { state: 'completed', updatedAt: '2026-07-19T00:00:00.000Z' };
    const normalized = { state: 'completed', updatedAt: '2026-07-20T00:00:00.000Z' };
    const result = assertConverged(runtime, normalized);
    expect(result.converged).toBe(true);
  });

  it('convergence: after fault injection and recovery, state matches', async () => {
    await harness.connect();
    const sessionId = await harness.startAdapterSession();
    await harness.waitForEvent('approval.requested', sessionId, 5000);

    await harness.disconnect();
    await harness.reconnect();

    const state = harness.captureState();
    expect(state.session).not.toBeNull();

    const result = harness.assertReplayEqualsSnapshot(sessionId);
    expect(result.equal).toBe(true);
  });
});
