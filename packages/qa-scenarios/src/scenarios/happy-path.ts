import type { Scenario } from "../scenario-types.js";

/**
 * Happy path — a session is created, an approval is requested and resolved,
 * and the session completes successfully.
 *
 * Used to validate the basic approval flow end-to-end.
 */
export const happyPath: Scenario = {
  id: "happy-path",
  description: "Session created → approval requested → approval resolved → session completed",
  steps: [
    {
      delayMs: 0,
      event: {
        type: "session.created",
        sessionId: "ses_happy_1",
        payload: {
          id: "ses_happy_1",
          title: "Refactor authentication module",
          state: "running",
          summary: "Updating auth flow to use JWT refresh tokens",
          currentAction: "Analyzing existing code",
          pendingApprovalCount: 0,
          pendingQuestionCount: 0,
          capabilities: { send: true, cancel: true, approvals: { command: true } },
          version: 1,
          createdAt: "2026-07-19T00:00:00.000Z",
          updatedAt: "2026-07-19T00:00:00.000Z",
        },
      },
    },
    {
      delayMs: 500,
      event: {
        type: "approval.requested",
        sessionId: "ses_happy_1",
        payload: {
          id: "apr_happy_1",
          sessionId: "ses_happy_1",
          category: "command",
          risk: "medium",
          reversible: "yes",
          title: "Execute: npm install jsonwebtoken",
          summary: "Install JWT library as a production dependency",
          decisions: ["approve", "reject"],
          expiresAt: null,
          version: 1,
        },
      },
    },
    {
      delayMs: 1000,
      event: {
        type: "approval.resolved",
        sessionId: "ses_happy_1",
        payload: {
          id: "apr_happy_1",
          state: "approved",
          version: 2,
        },
      },
    },
    {
      delayMs: 1500,
      event: {
        type: "session.completed",
        sessionId: "ses_happy_1",
        payload: {
          id: "ses_happy_1",
          summary: "JWT refresh token flow implemented. Tests passing.",
          version: 3,
          updatedAt: "2026-07-19T00:01:30.000Z",
        },
      },
    },
  ],
};
