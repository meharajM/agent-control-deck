import type { Scenario } from "../scenario-types.js";

/**
 * Reconnect scenario — validates that:
 * 1. A pending approval survives a disconnect/reconnect cycle.
 * 2. The client does not re-apply already-applied events after reconnect.
 * 3. The approval is resolved correctly after reconnect.
 *
 * DISCONNECT and RECONNECT are sentinel event types consumed by the
 * scenario runner, not emitted to the mobile store directly.
 */
export const reconnect: Scenario = {
  id: "reconnect",
  description:
    "Session created → approval requested → disconnect → reconnect → approval resolved → session completed",
  steps: [
    {
      delayMs: 0,
      event: {
        type: "session.created",
        sessionId: "ses_reconnect_1",
        payload: {
          id: "ses_reconnect_1",
          title: "Implement retry logic",
          state: "running",
          summary: "Adding exponential backoff to HTTP client",
          currentAction: "Writing retry middleware",
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
      delayMs: 200,
      event: {
        type: "approval.requested",
        sessionId: "ses_reconnect_1",
        payload: {
          id: "apr_reconnect_1",
          sessionId: "ses_reconnect_1",
          category: "network",
          risk: "low",
          reversible: "yes",
          title: "Access: api.example.com",
          summary: "Test retry logic against live endpoint",
          decisions: ["approve", "reject"],
          expiresAt: null,
          version: 1,
        },
      },
    },
    {
      // Sentinel: scenario runner disconnects the WebSocket at this point.
      delayMs: 400,
      event: {
        type: "DISCONNECT",
        sessionId: "ses_reconnect_1",
        payload: { reason: "simulated network loss" },
      },
    },
    {
      // Sentinel: scenario runner reconnects and replays from last sequence.
      delayMs: 600,
      event: {
        type: "RECONNECT",
        sessionId: "ses_reconnect_1",
        payload: { replayFromSequence: 1 },
      },
    },
    {
      delayMs: 800,
      event: {
        type: "approval.resolved",
        sessionId: "ses_reconnect_1",
        payload: {
          id: "apr_reconnect_1",
          state: "approved",
          version: 2,
        },
      },
    },
    {
      delayMs: 1000,
      event: {
        type: "session.completed",
        sessionId: "ses_reconnect_1",
        payload: {
          id: "ses_reconnect_1",
          summary: "Retry logic implemented with exponential backoff.",
          version: 4,
          updatedAt: "2026-07-19T00:01:00.000Z",
        },
      },
    },
  ],
};
