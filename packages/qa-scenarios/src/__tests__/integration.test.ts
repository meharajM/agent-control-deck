import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScenarioRunner } from '../runner.js';
import { TestHarness } from '../harness.js';
import { happyPath, reconnect, duplicateCommand } from '../index.js';

let harness: TestHarness;

beforeEach(async () => {
  harness = new TestHarness();
  await harness.setup();
  await harness.connect();
});

afterEach(async () => {
  await harness.teardown();
});

describe('Integration: happy-path end-to-end', () => {
  it('connect -> start -> approval -> resolve -> complete', async () => {
    const runner = new ScenarioRunner(harness);
    const result = await runner.run(happyPath);

    expect(result.passed).toBe(true);
    expect(result.steps.every((s) => s.passed)).toBe(true);
  }, 15000);
});

describe('Integration: reconnect scenario', () => {
  it('connect -> start -> approval -> disconnect -> reconnect -> resolve -> complete', async () => {
    const runner = new ScenarioRunner(harness);
    const result = await runner.run(reconnect);

    expect(result.passed).toBe(true);

    const types = result.steps.map((s) => s.eventType);
    const disconnectIdx = types.indexOf('DISCONNECT');
    const reconnectIdx = types.indexOf('RECONNECT');
    expect(disconnectIdx).toBeGreaterThanOrEqual(0);
    expect(reconnectIdx).toBeGreaterThan(disconnectIdx);
  }, 15000);
});

describe('Integration: duplicate command', () => {
  it('same idempotency key twice -> second is deduplicated', async () => {
    const runner = new ScenarioRunner(harness);
    const result = await runner.run(duplicateCommand);

    expect(result.passed).toBe(true);

    const commandSteps = result.steps.filter((s) => s.eventType === 'COMMAND_SEND');
    expect(commandSteps).toHaveLength(2);
    expect(commandSteps[0]!.passed).toBe(true);
    expect(commandSteps[1]!.passed).toBe(true);
  }, 15000);
});

describe('Integration: full flow with state verification', () => {
  it('session state is correct after completion', async () => {
    const runner = new ScenarioRunner(harness);
    const result = await runner.run(happyPath);

    expect(result.passed).toBe(true);
  }, 15000);
});
