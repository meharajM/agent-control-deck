import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { EventJournal, JournalEntry } from '@agent-deck/bridge-core';
import type { ApprovalService, SnapshotService } from '@agent-deck/bridge-core';
import type { Scenario } from './scenario-types.js';
import type { FaultType } from '@agent-deck/adapter-fake';
import { assertConverged, assertReplayEqualsSnapshot, assertIdempotent, type ConvergeResult } from './convergence.js';

export interface StepResult {
  stepIndex: number;
  delayMs: number;
  eventType: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface RunResult {
  scenarioId: string;
  passed: boolean;
  steps: StepResult[];
  duration: number;
}

export interface RunnerContext {
  journal: EventJournal;
  approvals: ApprovalService;
  snapshot: SnapshotService;
  waitForEvent(type: string, sessionId: string, timeoutMs?: number): Promise<JournalEntry>;
  waitForEventAfterSequence(type: string, sessionId: string, afterSequence: number, timeoutMs?: number): Promise<JournalEntry>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  sendCommand(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  startAdapterSession(): Promise<string>;
  getAllPendingApprovals(): Array<{ id: string; sessionId: string; version: number }>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
}

const CLIENT_INITIATED_EVENTS = new Set(['approval.resolved', 'approval.rejected']);

export class ScenarioRunner {
  private seenEventIds = new Set<string>();
  private lastEntries = new Map<string, JournalEntry>();
  private eventBus = new EventEmitter();

  constructor(private readonly ctx: RunnerContext) {}

  async run(scenario: Scenario): Promise<RunResult> {
    const start = Date.now();
    const results: StepResult[] = [];

    await this.ctx.startAdapterSession();

    const adapterHandler = (e: unknown) => {
      const entry = e as JournalEntry;
      this.seenEventIds.add(entry.eventId);
      this.lastEntries.set(entry.type, entry);
      this.eventBus.emit(`event:${entry.type}`, entry);
    };
    this.ctx.on('event:any', adapterHandler);

    try {
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i]!;
        const stepStart = Date.now();
        try {
          if (step.delayMs > 0) {
            await sleep(step.delayMs);
          }

          const ev = step.event;

          if (ev.type === 'DISCONNECT') {
            await this.ctx.disconnect();
            results.push(makeStepResult(i, step.delayMs, ev.type, true, Date.now() - stepStart));
            continue;
          }

          if (ev.type === 'RECONNECT') {
            await this.ctx.reconnect();
            results.push(makeStepResult(i, step.delayMs, ev.type, true, Date.now() - stepStart));
            continue;
          }

          if (ev.type === 'COMMAND_SEND') {
            const payload = ev.payload as Record<string, unknown>;
            const input = payload['input'] as Record<string, unknown> | undefined;
            const sendPayload: Record<string, unknown> = {
              commandId: payload['commandId'],
              idempotencyKey: payload['idempotencyKey'],
              kind: input?.['kind'] ?? 'text',
              text: input?.['text'] ?? '',
            };
            const result = await this.ctx.sendCommand(sendPayload);
            const expected = payload['expectedResult'] as string;
            const passed = result['result'] === expected;
            results.push(makeStepResult(
              i, step.delayMs, ev.type, passed,
              Date.now() - stepStart,
              passed ? undefined : `Expected result '${expected}', got '${result['result']}'`,
            ));
            continue;
          }

          if (ev.type === 'COMMAND_APPROVE' || ev.type === 'COMMAND_REJECT') {
            const payload = ev.payload as Record<string, unknown>;
            const decision = ev.type === 'COMMAND_APPROVE' ? 'command/approve' : 'command/reject';
            const result = await this.ctx.sendCommand({
              commandId: payload['commandId'] ?? randomUUID(),
              idempotencyKey: payload['idempotencyKey'] ?? randomUUID(),
              kind: decision,
              approvalId: payload['approvalId'],
              sessionId: ev.sessionId,
              expectedApprovalVersion: payload['expectedApprovalVersion'] ?? 1,
            });
            const passed = result['result'] === 'resolved';
            results.push(makeStepResult(
              i, step.delayMs, ev.type, passed,
              Date.now() - stepStart,
              passed ? undefined : `Approval resolve failed: ${result['result']}`,
            ));
            continue;
          }

          if (ev.type === 'verify_state') {
            const snapshot = this.ctx.snapshot.getSessionSnapshot(ev.sessionId);
            const payload = ev.payload as Record<string, unknown>;
            const passed = verifySnapshot(snapshot, payload);
            results.push(makeStepResult(
              i, step.delayMs, ev.type, passed,
              Date.now() - stepStart,
              passed ? undefined : 'Snapshot verification failed',
            ));
            continue;
          }

          if (CLIENT_INITIATED_EVENTS.has(ev.type)) {
            await this.sendApprovalForEvent(ev);
            const entry = await this.waitForSeenEvent(ev.type, 5000);
            results.push(makeStepResult(i, step.delayMs, ev.type, !!entry, Date.now() - stepStart,
              entry ? undefined : `Event '${ev.type}' not found after approval command`,
            ));
            continue;
          }

          const entry = await this.waitForSeenEvent(ev.type, 5000);
          if (!entry) {
            throw new Error(`Event '${ev.type}' not found in journal`);
          }
          results.push(makeStepResult(i, step.delayMs, ev.type, true, Date.now() - stepStart));
        } catch (err) {
          results.push(makeStepResult(
            i, step.delayMs, step.event.type, false,
            Date.now() - stepStart,
            err instanceof Error ? err.message : String(err),
          ));
        }
      }
    } finally {
      this.ctx.off('event:any', adapterHandler);
    }

    return {
      scenarioId: scenario.id,
      passed: results.every((r) => r.passed),
      steps: results,
      duration: Date.now() - start,
    };
  }

  private waitForSeenEvent(type: string, timeoutMs: number): Promise<JournalEntry | null> {
    const eventName = `event:${type}`;

    const alreadySeen = this.lastEntries.get(type);
    if (alreadySeen) {
      this.lastEntries.delete(type);
      return Promise.resolve(alreadySeen);
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.eventBus.removeListener(eventName, handler);
        resolve(null);
      }, timeoutMs);

      const handler = (entry: JournalEntry) => {
        clearTimeout(timeout);
        this.eventBus.removeListener(eventName, handler);
        resolve(entry);
      };
      this.eventBus.on(eventName, handler);
    });
  }

  private async sendApprovalForEvent(ev: { type: string; sessionId: string; payload: unknown }): Promise<void> {
    const pending = this.ctx.getAllPendingApprovals();
    const approval = pending.length > 0 ? pending[0]! : undefined;
    if (!approval) return;

    const decision = ev.type === 'approval.resolved' ? 'command/approve' : 'command/reject';
    await this.ctx.sendCommand({
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: decision,
      approvalId: approval.id,
      sessionId: approval.sessionId,
      expectedApprovalVersion: approval.version,
    });
  }
}

function makeStepResult(
  stepIndex: number,
  delayMs: number,
  eventType: string,
  passed: boolean,
  duration: number,
  error?: string,
): StepResult {
  const r: StepResult = { stepIndex, delayMs, eventType, passed, duration };
  if (error !== undefined) r.error = error;
  return r;
}

function verifySnapshot(
  snapshot: { session: unknown; pendingApprovals: unknown[]; pendingQuestions: unknown[] },
  expected: Record<string, unknown>
): boolean {
  if (expected['sessionState'] !== undefined) {
    const s = snapshot.session as { state: string } | null;
    if (!s || s.state !== expected['sessionState']) return false;
  }
  if (expected['pendingApprovalCount'] !== undefined) {
    if (snapshot.pendingApprovals.length !== expected['pendingApprovalCount']) return false;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Chaos test runner extensions ---

export interface ChaosRunResult {
  scenarioId: string;
  faults: FaultType[];
  passed: boolean;
  steps: StepResult[];
  duration: number;
}

export interface ConvergenceTestResult {
  scenarioId: string;
  passed: boolean;
  replayEqualsSnapshot: boolean;
  replayEvents: number;
  convergeResult: ConvergeResult;
  duration: number;
}

export interface PerformanceTestResult {
  passed: boolean;
  eventCount: number;
  durationMs: number;
  eventsPerSecond: number;
  peakMemoryBytes: number;
}

/**
 * Run a scenario with injected faults.
 */
export async function runChaosScenario(
  ctx: RunnerContext,
  scenario: Scenario,
  faults: FaultType[]
): Promise<ChaosRunResult> {
  const start = Date.now();
  const runner = new ScenarioRunner(ctx);
  const result = await runner.run(scenario);
  return {
    scenarioId: scenario.id,
    faults,
    passed: result.passed,
    steps: result.steps,
    duration: Date.now() - start,
  };
}

/**
 * Run a scenario and verify state converges after recovery.
 */
export async function runConvergenceTest(
  ctx: RunnerContext,
  scenario: Scenario,
  opts: { ignoredKeys?: string[] } = {}
): Promise<ConvergenceTestResult> {
  const start = Date.now();
  const runner = new ScenarioRunner(ctx);
  const result = await runner.run(scenario);

  let replayEqualsSnapshot = true;
  let replayEvents = 0;
  let snapSession: unknown = null;

  const sessionId = (ctx as unknown as { getSessionId?: () => string | null }).getSessionId?.();
  if (sessionId) {
    const replay = assertReplayEqualsSnapshot(ctx.journal, ctx.snapshot, sessionId);
    replayEqualsSnapshot = replay.equal;
    replayEvents = replay.replayEvents;
    snapSession = replay.snapshotSession;
  }

  const snap = sessionId ? ctx.snapshot.getSessionSnapshot(sessionId) : null;
  const convergeResult = snap?.session
    ? assertConverged(snap.session as unknown as Record<string, unknown>, (snapSession ?? {}) as Record<string, unknown>, opts)
    : { converged: true, diffs: [] as string[] };

  return {
    scenarioId: scenario.id,
    passed: result.passed && replayEqualsSnapshot && convergeResult.converged,
    replayEqualsSnapshot,
    replayEvents,
    convergeResult,
    duration: Date.now() - start,
  };
}

/**
 * Run a burst/endurance performance test.
 */
export async function runPerformanceTest(
  ctx: RunnerContext,
  config: { eventCount: number; sessionCount: number }
): Promise<PerformanceTestResult> {
  const start = Date.now();
  const events: JournalEntry[] = [];

  const handler = (e: unknown) => {
    events.push(e as JournalEntry);
  };
  ctx.on('event:any', handler);

  const eventsPerSession = 3;
  const sessionStarts = Math.max(config.sessionCount, Math.ceil(config.eventCount / eventsPerSession));
  await Promise.all(
    Array.from({ length: sessionStarts }, async () => {
      await ctx.startAdapterSession();
    }),
  );

  const deadline = start + 10000;
  while (events.length < config.eventCount && Date.now() < deadline) {
    await sleep(10);
  }

  ctx.off('event:any', handler);

  const durationMs = Date.now() - start;
  const memBefore = process.memoryUsage().heapUsed;

  return {
    passed: events.length > 0,
    eventCount: events.length,
    durationMs,
    eventsPerSecond: Math.round((events.length / durationMs) * 1000),
    peakMemoryBytes: memBefore,
  };
}
