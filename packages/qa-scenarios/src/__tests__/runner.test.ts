import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScenarioRunner } from '../runner.js';
import { TestHarness } from '../harness.js';
import { happyPath, reconnect, duplicateCommand } from '../index.js';

let harness: TestHarness;

beforeEach(async () => {
  harness = new TestHarness();
  await harness.setup();
});

afterEach(async () => {
  await harness.teardown();
});

describe('ScenarioRunner', () => {
  it('runs happy-path scenario', async () => {
    await harness.connect();
    const runner = new ScenarioRunner(harness);
    const result = await runner.run(happyPath);

    expect(result.scenarioId).toBe('happy-path');
    expect(result.passed).toBe(true);
    expect(result.steps).toHaveLength(happyPath.steps.length);
    expect(result.duration).toBeGreaterThanOrEqual(0);

    for (const step of result.steps) {
      expect(step.passed).toBe(true);
      expect(step.error).toBeUndefined();
    }
  }, 15000);

  it('happy-path produces expected events in order', async () => {
    await harness.connect();
    const runner = new ScenarioRunner(harness);
    const result = await runner.run(happyPath);

    const eventTypes = result.steps
      .filter((s) => !['DISCONNECT', 'RECONNECT', 'COMMAND_SEND', 'COMMAND_APPROVE', 'COMMAND_REJECT', 'verify_state'].includes(s.eventType))
      .map((s) => s.eventType);
    expect(eventTypes).toEqual([
      'session.created',
      'approval.requested',
      'approval.resolved',
      'session.completed',
    ]);
  }, 15000);

  it('runs reconnect scenario', async () => {
    await harness.connect();
    const runner = new ScenarioRunner(harness);
    const result = await runner.run(reconnect);

    expect(result.scenarioId).toBe('reconnect');
    expect(result.passed).toBe(true);

    const types = result.steps.map((s) => s.eventType);
    expect(types).toContain('DISCONNECT');
    expect(types).toContain('RECONNECT');
  }, 15000);

  it('runs duplicate-command scenario', async () => {
    await harness.connect();
    const runner = new ScenarioRunner(harness);
    const result = await runner.run(duplicateCommand);

    expect(result.scenarioId).toBe('duplicate-command');
    expect(result.passed).toBe(true);

    const commandSteps = result.steps.filter((s) => s.eventType === 'COMMAND_SEND');
    expect(commandSteps).toHaveLength(2);
    expect(commandSteps[0]!.passed).toBe(true);
    expect(commandSteps[1]!.passed).toBe(true);
  }, 15000);

  it('timing is within reasonable bounds', async () => {
    await harness.connect();
    const runner = new ScenarioRunner(harness);
    const start = Date.now();
    const result = await runner.run(happyPath);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(15000);
    expect(result.duration).toBeGreaterThan(0);
  }, 15000);
});
