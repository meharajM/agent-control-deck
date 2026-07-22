export { happyPath } from "./scenarios/happy-path.js";
export { reconnect } from "./scenarios/reconnect.js";
export { duplicateCommand } from "./scenarios/duplicate-command.js";
export { networkTransition } from "./scenarios/network-transition.js";
export { twoDeviceRace } from "./scenarios/two-device-race.js";
export { bridgeRestart } from "./scenarios/bridge-restart.js";
export { runtimeCrash } from "./scenarios/runtime-crash.js";
export { socketCloseBeforeAck } from "./scenarios/socket-close-before-ack.js";
export { socketCloseAfterAck } from "./scenarios/socket-close-after-ack.js";
export { clockSkew } from "./scenarios/clock-skew.js";
export { buildPerformanceScenario, buildReconnectEnduranceScenario, DEFAULT_PERF_CONFIG } from "./scenarios/performance.js";
export type { PerformanceConfig } from "./scenarios/performance.js";
export type { Scenario, ScenarioStep, ScenarioEvent } from "./scenario-types.js";

export * from "./conformance/index.js";
export * from "./convergence.js";

import { happyPath } from "./scenarios/happy-path.js";
import { reconnect } from "./scenarios/reconnect.js";
import { duplicateCommand } from "./scenarios/duplicate-command.js";
import { networkTransition } from "./scenarios/network-transition.js";
import { twoDeviceRace } from "./scenarios/two-device-race.js";
import { bridgeRestart } from "./scenarios/bridge-restart.js";
import { runtimeCrash } from "./scenarios/runtime-crash.js";
import { socketCloseBeforeAck } from "./scenarios/socket-close-before-ack.js";
import { socketCloseAfterAck } from "./scenarios/socket-close-after-ack.js";
import { clockSkew } from "./scenarios/clock-skew.js";
import type { Scenario } from "./scenario-types.js";

export const allScenarios: Scenario[] = [
  happyPath, reconnect, duplicateCommand,
  networkTransition, twoDeviceRace, bridgeRestart, runtimeCrash,
  socketCloseBeforeAck, socketCloseAfterAck, clockSkew,
];

export { ScenarioRunner } from "./runner.js";
export type { RunResult, StepResult, RunnerContext } from "./runner.js";
export { runChaosScenario, runConvergenceTest, runPerformanceTest } from "./runner.js";
export type { ChaosRunResult, ConvergenceTestResult, PerformanceTestResult } from "./runner.js";
export { TestHarness } from "./harness.js";
