import type { Scenario } from '../scenario-types.js';

/**
 * Runtime crash scenario — fake adapter emits crash event,
 * verify session marked failed/interrupted, no stale approval actionability.
 */
export const runtimeCrash: Scenario = {
  id: 'runtime-crash',
  description: 'Runtime crash: adapter crashes mid-session, verify state',
  steps: [
    {
      delayMs: 0,
      event: {
        type: 'session.created',
        sessionId: 'ses_crash_1',
        payload: {
          id: 'ses_crash_1',
          title: 'Crash test session',
          state: 'running',
          summary: 'Working before crash',
          pendingApprovalCount: 0,
          pendingQuestionCount: 0,
          version: 1,
        },
      },
    },
    {
      delayMs: 200,
      event: {
        type: 'approval.requested',
        sessionId: 'ses_crash_1',
        payload: {
          id: 'apr_crash_1',
          sessionId: 'ses_crash_1',
          category: 'file_write',
          risk: 'low',
          reversible: 'yes',
          title: 'Write file',
          summary: 'Create file before crash',
          decisions: ['approve', 'reject'],
          version: 1,
        },
      },
    },
    {
      delayMs: 400,
      event: {
        type: 'session.failed',
        sessionId: 'ses_crash_1',
        payload: {
          id: 'ses_crash_1',
          status: 'failed',
          error: 'Runtime crash: segfault in worker process',
          version: 2,
        },
      },
    },
    {
      delayMs: 600,
      event: {
        type: 'verify_state',
        sessionId: 'ses_crash_1',
        payload: { sessionState: 'failed', pendingApprovalCount: 0 },
      },
    },
  ],
};
