import type { Scenario } from '../scenario-types.js';

/**
 * Socket close before ACK scenario — drop socket before ACK arrives.
 */
export const socketCloseBeforeAck: Scenario = {
  id: 'socket-close-before-ack',
  description: 'Socket closes before ACK arrives — command must not dispatch',
  steps: [
    {
      delayMs: 0,
      event: {
        type: 'session.created',
        sessionId: 'ses_scb_1',
        payload: {
          id: 'ses_scb_1',
          title: 'Pre-ACK drop test',
          state: 'running',
          summary: 'Testing pre-ACK disconnect',
          pendingApprovalCount: 0,
          pendingQuestionCount: 0,
          version: 1,
        },
      },
    },
    {
      delayMs: 100,
      event: {
        type: 'COMMAND_SEND',
        sessionId: 'ses_scb_1',
        payload: {
          commandId: 'cmd_scb_1',
          idempotencyKey: 'idem_scb_1',
          input: { kind: 'text', text: 'Run tests' },
          expectedResult: 'accepted',
        },
      },
    },
    {
      delayMs: 200,
      event: {
        type: 'DISCONNECT',
        sessionId: 'ses_scb_1',
        payload: { reason: 'Socket closed before ACK processed' },
      },
    },
    {
      delayMs: 400,
      event: {
        type: 'RECONNECT',
        sessionId: 'ses_scb_1',
        payload: { replayFromSequence: 0 },
      },
    },
  ],
};
