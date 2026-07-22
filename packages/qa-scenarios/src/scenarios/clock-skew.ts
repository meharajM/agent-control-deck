import type { Scenario } from '../scenario-types.js';

/**
 * Clock skew scenario — events with timestamps in future/past.
 * Verifies that sequence numbers drive ordering, not timestamps.
 */
export const clockSkew: Scenario = {
  id: 'clock-skew',
  description: 'Events with skewed timestamps — sequence drives ordering',
  steps: [
    {
      delayMs: 0,
      event: {
        type: 'session.created',
        sessionId: 'ses_clock_1',
        payload: {
          id: 'ses_clock_1',
          title: 'Clock skew test',
          state: 'running',
          summary: 'Testing timestamp ordering',
          pendingApprovalCount: 0,
          pendingQuestionCount: 0,
          version: 1,
          createdAt: '2026-07-19T00:00:00.000Z',
        },
      },
    },
    {
      delayMs: 200,
      event: {
        type: 'session.updated',
        sessionId: 'ses_clock_1',
        payload: {
          summary: 'Future timestamp event',
          currentAction: 'Step 2',
          version: 2,
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      },
    },
    {
      delayMs: 400,
      event: {
        type: 'session.updated',
        sessionId: 'ses_clock_1',
        payload: {
          summary: 'Past timestamp event',
          currentAction: 'Step 3',
          version: 3,
          updatedAt: '2026-07-18T00:00:00.000Z',
        },
      },
    },
    {
      delayMs: 600,
      event: {
        type: 'session.completed',
        sessionId: 'ses_clock_1',
        payload: {
          id: 'ses_clock_1',
          summary: 'Done despite clock skew',
          version: 4,
          updatedAt: '2026-07-19T12:00:00.000Z',
        },
      },
    },
  ],
};
