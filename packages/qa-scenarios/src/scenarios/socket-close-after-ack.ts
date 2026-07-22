import type { Scenario } from '../scenario-types.js';

/**
 * Socket close after ACK but before runtime confirm scenario.
 */
export const socketCloseAfterAck: Scenario = {
  id: 'socket-close-after-ack',
  description: 'Socket closes after ACK but before runtime confirms',
  steps: [
    {
      delayMs: 0,
      event: {
        type: 'session.created',
        sessionId: 'ses_sca_1',
        payload: {
          id: 'ses_sca_1',
          title: 'Post-ACK drop test',
          state: 'running',
          summary: 'Testing post-ACK disconnect',
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
        sessionId: 'ses_sca_1',
        payload: {
          commandId: 'cmd_sca_1',
          idempotencyKey: 'idem_sca_1',
          input: { kind: 'text', text: 'Run tests' },
          expectedResult: 'accepted',
        },
      },
    },
    {
      delayMs: 150,
      event: {
        type: 'instruction.accepted',
        sessionId: 'ses_sca_1',
        payload: { text: 'Run tests' },
      },
    },
    {
      delayMs: 200,
      event: {
        type: 'DISCONNECT',
        sessionId: 'ses_sca_1',
        payload: { reason: 'Socket closed after ACK, before runtime confirm' },
      },
    },
    {
      delayMs: 400,
      event: {
        type: 'RECONNECT',
        sessionId: 'ses_sca_1',
        payload: { replayFromSequence: 0 },
      },
    },
  ],
};
