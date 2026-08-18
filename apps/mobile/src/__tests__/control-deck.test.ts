import { describe, expect, it } from "vitest";
import {
  COMPLETED_RETENTION_MS,
  getAvailableDeckCommands,
  resolvePinnedCommands,
  selectDeckSessions,
} from "../services/control-deck.js";
import type { NormalizedSession } from "../types.js";

const NOW = Date.parse("2026-07-22T10:00:00.000Z");

function session(
  id: string,
  state: NormalizedSession["state"],
  updatedAt: string,
  capabilities: Record<string, unknown> = {},
): NormalizedSession {
  return {
    id,
    title: id,
    state,
    summary: "",
    currentAction: null,
    pendingApprovalCount: 0,
    pendingQuestionCount: 0,
    capabilities,
    version: 1,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("selectDeckSessions", () => {
  it("shows all active and attention sessions but hides idle sessions", () => {
    const sessions = {
      running: session("running", "running", "2026-07-22T09:55:00.000Z"),
      approval: session("approval", "waiting_approval", "2026-07-22T09:54:00.000Z"),
      idle: session("idle", "idle", "2026-07-22T09:59:00.000Z"),
    };

    expect(selectDeckSessions(sessions, new Set(), NOW).map((item) => item.id)).toEqual([
      "approval",
      "running",
    ]);
  });

  it("retains completed sessions for exactly the one-hour window", () => {
    const visibleTime = new Date(NOW - COMPLETED_RETENTION_MS + 1).toISOString();
    const expiredTime = new Date(NOW - COMPLETED_RETENTION_MS).toISOString();
    const sessions = {
      visible: session("visible", "completed", visibleTime),
      expired: session("expired", "completed", expiredTime),
    };

    expect(selectDeckSessions(sessions, new Set(), NOW).map((item) => item.id)).toEqual([
      "visible",
    ]);
  });

  it("hides a session immediately after local dismissal", () => {
    const completed = session("done", "completed", "2026-07-22T09:55:00.000Z");
    expect(selectDeckSessions({ done: completed }, new Set(["done"]), NOW)).toEqual([]);
  });

  it("shows a dismissed session again if the runtime makes it active", () => {
    const running = session("done", "running", "2026-07-22T09:58:00.000Z");
    expect(selectDeckSessions({ done: running }, new Set(["done"]), NOW)).toEqual([running]);
  });

  it("orders attention before problems, running work, and completion", () => {
    const sessions = {
      done: session("done", "completed", "2026-07-22T09:59:00.000Z"),
      running: session("running", "running", "2026-07-22T09:58:00.000Z"),
      problem: session("problem", "failed", "2026-07-22T09:57:00.000Z"),
      attention: session("attention", "waiting_user", "2026-07-22T09:56:00.000Z"),
    };

    expect(selectDeckSessions(sessions, new Set(), NOW).map((item) => item.id)).toEqual([
      "attention",
      "problem",
      "running",
      "done",
    ]);
  });
});

describe("deck commands", () => {
  it("shows focus only when the host advertises exact-session desktop focus", () => {
    const withoutFocus = getAvailableDeckCommands(
      session("one", "running", "2026-07-22T09:55:00.000Z", {
        send: true,
        cancel: true,
      }),
    );
    const withFocus = getAvailableDeckCommands(
      session("two", "running", "2026-07-22T09:55:00.000Z", {
        send: true,
        cancel: true,
        desktopFocus: true,
      }),
    );

    expect(withoutFocus.some((command) => command.id === "focus")).toBe(false);
    expect(withFocus.some((command) => command.id === "focus")).toBe(true);
  });

  it("uses three defaults but preserves any number of configured available commands", () => {
    const available = getAvailableDeckCommands(
      session("one", "running", "2026-07-22T09:55:00.000Z", {
        send: true,
        cancel: true,
        desktopFocus: true,
        previews: { diff: true },
      }),
    );

    expect(resolvePinnedCommands(available, [])).toHaveLength(3);
    expect(
      resolvePinnedCommands(available, [
        "focus",
        "summarize",
        "explain_blocker",
        "review_diff",
        "run_tests",
        "prepare_handoff",
        "stop",
      ]),
    ).toHaveLength(7);
  });
});
