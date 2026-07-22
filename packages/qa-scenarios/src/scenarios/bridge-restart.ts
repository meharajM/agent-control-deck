import type { Scenario } from '../scenario-types.js';

/**
 * Bridge restart scenario — kill bridge process, restart, verify sessions restored.
 */
export const bridgeRestart: Scenario = {
  id: 'bridge-restart',
  description: 'Bridge restart: kill, restart, verify sessions restored',
  steps: [
    {
      delayMs: 0,
      event: {
        type: 'session.created',
        sessionId: 'ses_restart_1',
        payload: {
          id: 'ses_restart_1',
          title: 'Restart test session',
          state: 'running',
          summary: 'Working before restart',
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
        sessionId: 'ses_restart_1',
        payload: {
          id: 'apr_restart_1',
          sessionId: 'ses_restart_1',
          category: 'command',
          risk: 'low',
          reversible: 'yes',
          title: 'Run tests',
          summary: 'Execute test suite',
          decisions: ['approve', 'reject'],
          version: 1,
        },
      },
    },
    {
      delayMs: 400,
      event: {
        type: 'DISCONNECT',
        sessionId: 'ses_restart_1',
        payload: { reason: 'Bridge process killed' },
      },
    },
    {
      delayMs: 800,
      event: {
        type: 'RECONNECT',
        sessionId: 'ses_restart_1',
        payload: { reason: 'Bridge restarted', replayFromSequence: 0 },
      },
    },
    {
      delayMs: 1000,
      event: {
        type: 'verify_state',
        sessionId: 'ses_restart_1',
        payload: { sessionState: 'running', pendingApprovalCount: 1 },
      },
    },
  ],
};
