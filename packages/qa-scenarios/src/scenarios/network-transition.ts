import type { Scenario } from '../scenario-types.js';

/**
 * Network transition scenario — Wi-Fi → cellular simulation.
 * Disconnect, reconnect with new route, verify state preserved.
 */
export const networkTransition: Scenario = {
  id: 'network-transition',
  description: 'Wi-Fi → cellular simulation: disconnect, reconnect, verify state',
  steps: [
    {
      delayMs: 0,
      event: {
        type: 'session.created',
        sessionId: 'ses_net_1',
        payload: {
          id: 'ses_net_1',
          title: 'Network test session',
          state: 'running',
          summary: 'Working on network transition',
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
        sessionId: 'ses_net_1',
        payload: {
          id: 'apr_net_1',
          sessionId: 'ses_net_1',
          category: 'network',
          risk: 'low',
          reversible: 'yes',
          title: 'API request',
          summary: 'External API call',
          decisions: ['approve', 'reject'],
          version: 1,
        },
      },
    },
    {
      delayMs: 400,
      event: {
        type: 'DISCONNECT',
        sessionId: 'ses_net_1',
        payload: { reason: 'Wi-Fi to cellular transition' },
      },
    },
    {
      delayMs: 600,
      event: {
        type: 'RECONNECT',
        sessionId: 'ses_net_1',
        payload: { reason: 'Cellular connected', replayFromSequence: 1 },
      },
    },
    {
      delayMs: 800,
      event: {
        type: 'verify_state',
        sessionId: 'ses_net_1',
        payload: { sessionState: 'running', pendingApprovalCount: 1 },
      },
    },
  ],
};
