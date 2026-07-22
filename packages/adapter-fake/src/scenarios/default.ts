import type { AdapterEvent } from '@agent-deck/adapter-contract';

/**
 * A scripted event step in a fake scenario.
 * delayMs: how long after the previous step to emit this event.
 */
export interface ScenarioStep {
  delayMs: number;
  type: string;
  payload: unknown;
}

/**
 * Default scenario: start → tool_approval_request → session_complete
 * // ponytail: in-memory only, replace with persistent store if throughput requires
 */
export const defaultScenario: ScenarioStep[] = [
  {
    delayMs: 100,
    type: 'session.started',
    payload: { status: 'running', message: 'Fake session started' },
  },
  {
    delayMs: 100,
    type: 'approval.requested',
    payload: {
      category: 'file_write',
      risk: 'low',
      reversible: 'yes',
      title: 'Write src/hello.ts',
      summary: 'Agent wants to create a TypeScript file',
      decisions: ['approve', 'reject'],
    },
  },
  {
    delayMs: 100,
    type: 'session.completed',
    payload: { status: 'completed', summary: 'Fake session finished successfully' },
  },
];

export function buildAdapterEvent(
  sessionId: string,
  step: ScenarioStep
): AdapterEvent {
  const payload =
    step.type === 'approval.requested' && step.payload && typeof step.payload === 'object'
      ? {
          ...(step.payload as Record<string, unknown>),
          approvalId:
            (step.payload as Record<string, unknown>).approvalId ??
            `fake-apr-${sessionId}`,
        }
      : step.payload;

  return {
    type: step.type,
    sessionId,
    payload,
    timestamp: new Date().toISOString(),
  };
}
