import type { Scenario } from '../scenario-types.js';

/**
 * Two-device race scenario — two fake phones answer same approval concurrently.
 * Only first wins, second gets APPROVAL_ALREADY_RESOLVED.
 */
export const twoDeviceRace: Scenario = {
  id: 'two-device-race',
  description: 'Two devices race to answer same approval — only first wins',
  steps: [
    {
      delayMs: 0,
      event: {
        type: 'session.created',
        sessionId: 'ses_race_1',
        payload: {
          id: 'ses_race_1',
          title: 'Race condition test',
          state: 'running',
          summary: 'Testing approval race',
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
        sessionId: 'ses_race_1',
        payload: {
          id: 'apr_race_1',
          sessionId: 'ses_race_1',
          category: 'file_write',
          risk: 'low',
          reversible: 'yes',
          title: 'Write file',
          summary: 'Create file',
          decisions: ['approve', 'reject'],
          version: 1,
        },
      },
    },
    {
      delayMs: 300,
      event: {
        type: 'COMMAND_APPROVE',
        sessionId: 'ses_race_1',
        payload: {
          approvalId: 'apr_race_1',
          expectedApprovalVersion: 1,
          idempotencyKey: 'race-device-a',
          commandId: 'cmd_race_a',
        },
      },
    },
    {
      delayMs: 350,
      event: {
        type: 'COMMAND_APPROVE',
        sessionId: 'ses_race_1',
        payload: {
          approvalId: 'apr_race_1',
          expectedApprovalVersion: 1,
          idempotencyKey: 'race-device-b',
          commandId: 'cmd_race_b',
        },
      },
    },
    {
      delayMs: 500,
      event: {
        type: 'session.completed',
        sessionId: 'ses_race_1',
        payload: {
          id: 'ses_race_1',
          summary: 'Done',
          version: 3,
        },
      },
    },
  ],
};
