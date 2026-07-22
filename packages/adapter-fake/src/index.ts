export { FakeAdapter } from './fake-adapter.js';
export type { FaultType } from './fake-adapter.js';
export { defaultScenario, buildAdapterEvent } from './scenarios/default.js';
export type { ScenarioStep } from './scenarios/default.js';
export {
  streamingScenario,
  multiApprovalScenario,
  networkApprovalScenario,
  questionScenario,
  cancelScenario,
  failureScenario,
  reconnectScenario,
  instructionScenario,
  minimalScenario,
  largePayloadScenario,
  crashRecoveryScenario,
  networkPartitionScenario,
  duplicateEventsScenario,
  reorderedEventsScenario,
  largePayloadFuzzScenario,
  backpressureScenario,
  scenarioRegistry,
} from './scenarios/variants.js';
