import type { Scenario } from "../scenario-types.js";

/**
 * Duplicate command prevention scenario.
 *
 * Validates that the bridge command ledger deduplicates commands with
 * the same idempotencyKey. The second command.send should return a
 * 'duplicate' result without dispatching to the runtime.
 *
 * This scenario is consumed by the bridge integration test harness;
 * the COMMAND_SEND steps are instructions to the harness to send a
 * session.send command (not inbound bridge events).
 */
export const duplicateCommand: Scenario = {
  id: "duplicate-command",
  description:
    "Session created → same command sent twice with the same idempotencyKey → second is deduplicated",
  steps: [
    {
      delayMs: 0,
      event: {
        type: "session.created",
        sessionId: "ses_dup_1",
        payload: {
          id: "ses_dup_1",
          title: "Run test suite",
          state: "idle",
          summary: "Ready to run tests",
          currentAction: null,
          pendingApprovalCount: 0,
          pendingQuestionCount: 0,
          capabilities: { send: true, cancel: true },
          version: 1,
          createdAt: "2026-07-19T00:00:00.000Z",
          updatedAt: "2026-07-19T00:00:00.000Z",
        },
      },
    },
    {
      // First command.send — should be accepted and dispatched.
      delayMs: 100,
      event: {
        type: "COMMAND_SEND",
        sessionId: "ses_dup_1",
        payload: {
          commandId: "cmd_dup_1",
          idempotencyKey: "idem_fixed_key_001",
          expectedSessionVersion: 1,
          input: { kind: "text", text: "Run all unit tests" },
          expectedResult: "accepted",
        },
      },
    },
    {
      // Second command.send with the SAME idempotencyKey — must be deduplicated.
      delayMs: 150,
      event: {
        type: "COMMAND_SEND",
        sessionId: "ses_dup_1",
        payload: {
          commandId: "cmd_dup_2",
          idempotencyKey: "idem_fixed_key_001", // same key
          expectedSessionVersion: 1,
          input: { kind: "text", text: "Run all unit tests" },
          expectedResult: "duplicate", // bridge must return duplicate, not dispatch again
        },
      },
    },
  ],
};
