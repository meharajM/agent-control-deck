/**
 * session-store.test.ts
 *
 * Tests the Zustand session store's applyEvent reducer.
 * All tests are pure — no React rendering required.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "../store/session-store.js";
import type { UcpEvent } from "../types.js";

// Helper to get a fresh store state between tests
function getStore() {
  return useSessionStore.getState();
}

beforeEach(() => {
  useSessionStore.getState().reset();
});

// ---------------------------------------------------------------------------
// session.created
// ---------------------------------------------------------------------------

describe("applyEvent session.created", () => {
  it("adds a new session", () => {
    const event: UcpEvent = {
      type: "session.created",
      payload: {
        id: "ses_1",
        title: "Fix login bug",
        state: "running",
        summary: "Working on auth module",
        currentAction: "Running tests",
        pendingApprovalCount: 0,
        pendingQuestionCount: 0,
        capabilities: {},
        version: 1,
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
      },
    };
    getStore().applyEvent(event);
    const session = getStore().sessions["ses_1"];
    expect(session).toBeDefined();
    expect(session?.title).toBe("Fix login bug");
    expect(session?.state).toBe("running");
    expect(session?.currentAction).toBe("Running tests");
  });

  it("is idempotent — applying the same event twice does not change state", () => {
    const event: UcpEvent = {
      type: "session.created",
      payload: {
        id: "ses_2",
        title: "Refactor DB layer",
        state: "idle",
        summary: "",
        version: 1,
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
      },
    };
    getStore().applyEvent(event);
    getStore().applyEvent(event);
    expect(Object.keys(getStore().sessions)).toHaveLength(1);
    expect(getStore().sessions["ses_2"]?.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// session.updated
// ---------------------------------------------------------------------------

describe("applyEvent session.updated", () => {
  const baseCreate: UcpEvent = {
    type: "session.created",
    payload: {
      id: "ses_3",
      title: "Add feature X",
      state: "running",
      summary: "In progress",
      version: 1,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    },
  };

  it("merges updated fields when version is newer", () => {
    getStore().applyEvent(baseCreate);
    const update: UcpEvent = {
      type: "session.updated",
      payload: {
        id: "ses_3",
        state: "waiting_approval",
        pendingApprovalCount: 1,
        version: 2,
        updatedAt: "2026-07-19T00:01:00.000Z",
      },
    };
    getStore().applyEvent(update);
    const session = getStore().sessions["ses_3"];
    expect(session?.state).toBe("waiting_approval");
    expect(session?.pendingApprovalCount).toBe(1);
    expect(session?.title).toBe("Add feature X"); // unchanged
    expect(session?.version).toBe(2);
  });

  it("ignores update with older version (idempotent)", () => {
    getStore().applyEvent(baseCreate);
    const staleUpdate: UcpEvent = {
      type: "session.updated",
      payload: {
        id: "ses_3",
        state: "completed",
        version: 0, // older than current version 1
        updatedAt: "2026-07-19T00:02:00.000Z",
      },
    };
    getStore().applyEvent(staleUpdate);
    expect(getStore().sessions["ses_3"]?.state).toBe("running"); // unchanged
  });
});

// ---------------------------------------------------------------------------
// approval.requested / approval.resolved
// ---------------------------------------------------------------------------

describe("applyEvent approval.requested", () => {
  it("adds approval to pendingApprovals", () => {
    const event: UcpEvent = {
      type: "approval.requested",
      payload: {
        id: "apr_1",
        sessionId: "ses_1",
        category: "command",
        risk: "medium",
        reversible: "yes",
        title: "Run: rm -rf dist",
        summary: "Delete build output",
        decisions: ["approve", "reject"],
        version: 1,
      },
    };
    getStore().applyEvent(event);
    const approval = getStore().pendingApprovals["apr_1"];
    expect(approval).toBeDefined();
    expect(approval?.risk).toBe("medium");
    expect(approval?.state).toBe("pending");
  });

  it("is idempotent — duplicate approval.requested ignored", () => {
    const event: UcpEvent = {
      type: "approval.requested",
      payload: {
        id: "apr_2",
        sessionId: "ses_1",
        category: "network",
        risk: "high",
        reversible: "no",
        title: "Access external API",
        summary: "POST to api.example.com",
        decisions: ["approve", "reject"],
        version: 1,
      },
    };
    getStore().applyEvent(event);
    getStore().applyEvent(event);
    expect(Object.keys(getStore().pendingApprovals)).toHaveLength(1);
  });
});

describe("applyEvent approval.resolved", () => {
  it("updates approval state to resolved (card stays, per UCP spec)", () => {
    const requested: UcpEvent = {
      type: "approval.requested",
      payload: {
        id: "apr_3",
        sessionId: "ses_1",
        category: "command",
        risk: "low",
        reversible: "yes",
        title: "Run tests",
        summary: "Execute test suite",
        decisions: ["approve", "reject"],
        version: 1,
      },
    };
    getStore().applyEvent(requested);

    const resolved: UcpEvent = {
      type: "approval.resolved",
      payload: { id: "apr_3", state: "approved", version: 2 },
    };
    getStore().applyEvent(resolved);

    const approval = getStore().pendingApprovals["apr_3"];
    // Card stays; state updated to terminal
    expect(approval?.state).toBe("approved");
  });
});

// ---------------------------------------------------------------------------
// markStale
// ---------------------------------------------------------------------------

describe("markStale", () => {
  it("sets connectionStatus to stale", () => {
    getStore().setConnectionStatus("connected");
    getStore().markStale();
    expect(getStore().connectionStatus).toBe("stale");
  });
});

// ---------------------------------------------------------------------------
// host.snapshot
// ---------------------------------------------------------------------------

describe("applyEvent host.snapshot", () => {
  it("populates sessions and approvals from snapshot", () => {
    const event: UcpEvent = {
      type: "host.snapshot",
      payload: {
        hostId: "host_1",
        sessions: [
          {
            id: "ses_snap_1",
            title: "From snapshot",
            state: "running",
            summary: "Working",
            version: 5,
            createdAt: "2026-07-19T00:00:00.000Z",
            updatedAt: "2026-07-19T00:00:00.000Z",
          },
        ],
        approvals: [
          {
            id: "apr_snap_1",
            sessionId: "ses_snap_1",
            category: "fileChange",
            risk: "low",
            reversible: "yes",
            title: "Write src/index.ts",
            summary: "Create entry file",
            decisions: ["approve", "reject"],
            version: 1,
          },
        ],
        questions: [],
        sequence: 42,
      },
    };
    getStore().applyEvent(event);
    expect(getStore().sessions["ses_snap_1"]?.title).toBe("From snapshot");
    expect(getStore().pendingApprovals["apr_snap_1"]?.category).toBe("fileChange");
    expect(getStore().lastSyncSequence).toBe(42);
  });
});
