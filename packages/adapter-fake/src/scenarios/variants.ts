import type { ScenarioStep } from './default.js';

/**
 * Streaming scenario: session with multiple update events before completion.
 * // ponytail: covers session.updated and long-running action tracking
 */
export const streamingScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Starting work' } },
  { delayMs: 50, type: 'session.updated', payload: { summary: 'Analyzing codebase', currentAction: 'Reading files' } },
  { delayMs: 50, type: 'session.updated', payload: { summary: 'Writing changes', currentAction: 'Editing src/index.ts' } },
  { delayMs: 50, type: 'session.updated', payload: { summary: 'Running tests', currentAction: 'npm test' } },
  { delayMs: 50, type: 'session.completed', payload: { status: 'completed', summary: 'All tests pass' } },
];

/**
 * Multi-approval scenario: two sequential approvals required.
 * // ponytail: covers approval flow with multiple decision points
 */
export const multiApprovalScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  {
    delayMs: 50,
    type: 'approval.requested',
    payload: {
      approvalId: 'multi-apr-001',
      category: 'file_write',
      risk: 'low',
      reversible: 'yes',
      title: 'Write config.ts',
      summary: 'Create configuration file',
      decisions: ['approve', 'reject'],
    },
  },
  {
    delayMs: 50,
    type: 'approval.requested',
    payload: {
      approvalId: 'multi-apr-002',
      category: 'command',
      risk: 'medium',
      reversible: 'no',
      title: 'Run migration',
      summary: 'Apply database migration',
      decisions: ['approve', 'reject'],
    },
  },
  { delayMs: 50, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
];

/**
 * Network approval scenario: high-risk network operation.
 * // ponytail: covers network category approval
 */
export const networkApprovalScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  {
    delayMs: 50,
    type: 'approval.requested',
    payload: {
      approvalId: 'net-apr-001',
      category: 'network',
      risk: 'high',
      reversible: 'no',
      title: 'API request to external service',
      summary: 'POST https://api.example.com/deploy',
      decisions: ['approve', 'reject'],
    },
  },
  { delayMs: 50, type: 'session.completed', payload: { status: 'completed', summary: 'Deployed' } },
];

/**
 * Question scenario: agent asks user a question.
 * // ponytail: covers question flow
 */
export const questionScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  {
    delayMs: 50,
    type: 'question.asked',
    payload: {
      questionId: 'q-001',
      prompt: 'Which test framework should I use?',
      options: ['vitest', 'jest', 'mocha'],
    },
  },
  { delayMs: 50, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
];

/**
 * Cancel scenario: session runs then gets cancelled by user.
 * // ponytail: covers cancel flow — scenario continues after cancel is harmless
 */
export const cancelScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Starting long task' } },
  { delayMs: 50, type: 'session.updated', payload: { summary: 'Processing', currentAction: 'Building...' } },
  { delayMs: 50, type: 'session.completed', payload: { status: 'completed', summary: 'Finished' } },
];

/**
 * Failure scenario: session fails mid-way.
 * // ponytail: covers failure state
 */
export const failureScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  { delayMs: 50, type: 'session.updated', payload: { summary: 'Compiling', currentAction: 'tsc' } },
  { delayMs: 50, type: 'session.failed', payload: { status: 'failed', error: 'TypeScript compilation failed' } },
];

/**
 * Reconnect scenario: approval requested, designed for disconnect/reconnect testing.
 * // ponytail: longer delays to give test time to disconnect
 */
export const reconnectScenario: ScenarioStep[] = [
  { delayMs: 100, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  {
    delayMs: 100,
    type: 'approval.requested',
    payload: {
      approvalId: 'recon-apr-001',
      category: 'file_change',
      risk: 'low',
      reversible: 'yes',
      title: 'Edit utils.ts',
      summary: 'Small refactor',
      decisions: ['approve', 'reject'],
    },
  },
  { delayMs: 100, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
];

/**
 * Instruction ack scenario: user sends instruction, adapter acknowledges.
 * // ponytail: covers instruction.accepted flow
 */
export const instructionScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Ready for instructions' } },
  { delayMs: 50, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
];

/**
 * No events scenario: session starts immediately with no intermediate steps.
 * // ponytail: minimal scenario for testing session lifecycle
 */
export const minimalScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.completed', payload: { status: 'completed', summary: 'Instant complete' } },
];

/**
 * Large payload scenario: events with substantial data.
 * // ponytail: tests payload handling with realistic data sizes
 */
export const largePayloadScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  {
    delayMs: 50,
    type: 'approval.requested',
    payload: {
      approvalId: 'large-apr-001',
      category: 'file_change',
      risk: 'medium',
      reversible: 'yes',
      title: 'Refactor authentication module',
      summary: 'Migrate from JWT to session-based auth. This involves changing middleware, adding Redis for session storage, updating all API endpoints, and modifying the frontend login flow.',
      decisions: ['approve', 'reject', 'modify'],
      details: {
        files: ['src/auth/middleware.ts', 'src/auth/session.ts', 'src/api/routes.ts', 'src/frontend/Login.tsx'],
        linesChanged: 847,
        testsAffected: 23,
      },
    },
  },
  { delayMs: 50, type: 'session.completed', payload: { status: 'completed', summary: 'Refactoring complete' } },
];

/**
 * Crash recovery scenario: runtime crashes mid-session, recovers with new session.
 * // ponytail: covers crash event and session failure state
 */
export const crashRecoveryScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  { delayMs: 50, type: 'session.updated', payload: { summary: 'Processing', currentAction: 'Building...' } },
  { delayMs: 50, type: 'session.failed', payload: { status: 'failed', error: 'Runtime crash: segfault' } },
];

/**
 * Network partition scenario: socket drops during approval, reconnects.
 * // ponytail: longer delays to simulate partition window
 */
export const networkPartitionScenario: ScenarioStep[] = [
  { delayMs: 100, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  {
    delayMs: 100,
    type: 'approval.requested',
    payload: {
      approvalId: 'np-apr-001',
      category: 'file_write',
      risk: 'low',
      reversible: 'yes',
      title: 'Write config',
      summary: 'Create configuration',
      decisions: ['approve', 'reject'],
    },
  },
  { delayMs: 100, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
];

/**
 * Duplicate events scenario: same event emitted twice.
 * // ponytail: covers duplicate event handling in journal/store
 */
export const duplicateEventsScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  { delayMs: 50, type: 'session.updated', payload: { summary: 'Step 1', currentAction: 'Processing' } },
  { delayMs: 50, type: 'session.updated', payload: { summary: 'Step 1', currentAction: 'Processing' } },
  { delayMs: 50, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
];

/**
 * Reordered events scenario: events arrive out of sequence.
 * // ponytail: covers out-of-order event handling
 */
export const reorderedEventsScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  { delayMs: 200, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
  { delayMs: 50, type: 'session.updated', payload: { summary: 'Step 2', currentAction: 'Finishing' } },
];

/**
 * Large payload fuzz scenario: event with 500KB diff preview.
 * // ponytail: covers large payload handling
 */
export const largePayloadFuzzScenario: ScenarioStep[] = [
  { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  {
    delayMs: 50,
    type: 'approval.requested',
    payload: {
      approvalId: 'lpf-apr-001',
      category: 'file_write',
      risk: 'medium',
      reversible: 'yes',
      title: 'Large refactor',
      summary: 'A'.repeat(500 * 1024),
      decisions: ['approve', 'reject'],
    },
  },
  { delayMs: 50, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
];

/**
 * Backpressure scenario: 100 events in rapid succession.
 * // ponytail: covers event processing under load
 */
export const backpressureScenario: ScenarioStep[] = [
  { delayMs: 10, type: 'session.started', payload: { status: 'running', message: 'Working' } },
  ...Array.from({ length: 100 }, (_, i) => ({
    delayMs: 1,
    type: 'session.updated' as string,
    payload: { summary: `Event ${i}`, currentAction: `Step ${i}` } as unknown,
  })),
  { delayMs: 10, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
];

/** Named scenario registry for dynamic selection. */
export const scenarioRegistry: Record<string, ScenarioStep[]> = {
  default: [], // empty = use adapter default
  streaming: streamingScenario,
  multiApproval: multiApprovalScenario,
  networkApproval: networkApprovalScenario,
  question: questionScenario,
  cancel: cancelScenario,
  failure: failureScenario,
  reconnect: reconnectScenario,
  instruction: instructionScenario,
  minimal: minimalScenario,
  largePayload: largePayloadScenario,
  crashRecovery: crashRecoveryScenario,
  networkPartition: networkPartitionScenario,
  duplicateEvents: duplicateEventsScenario,
  reorderedEvents: reorderedEventsScenario,
  largePayloadFuzz: largePayloadFuzzScenario,
  backpressure: backpressureScenario,
};
