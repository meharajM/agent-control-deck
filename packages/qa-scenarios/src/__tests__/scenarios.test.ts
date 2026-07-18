import { describe, expect, it } from "vitest";
import { allScenarios, duplicateCommand, happyPath, reconnect } from "../index.js";

describe("happy-path scenario", () => {
  it("has exactly 4 steps", () => {
    expect(happyPath.steps).toHaveLength(4);
  });

  it("first step is session.created at 0ms", () => {
    const first = happyPath.steps[0]!;
    expect(first.delayMs).toBe(0);
    expect(first.event.type).toBe("session.created");
  });

  it("second step is approval.requested at 500ms", () => {
    const step = happyPath.steps[1]!;
    expect(step.delayMs).toBe(500);
    expect(step.event.type).toBe("approval.requested");
  });

  it("third step is approval.resolved at 1000ms", () => {
    const step = happyPath.steps[2]!;
    expect(step.delayMs).toBe(1000);
    expect(step.event.type).toBe("approval.resolved");
  });

  it("fourth step is session.completed at 1500ms", () => {
    const step = happyPath.steps[3]!;
    expect(step.delayMs).toBe(1500);
    expect(step.event.type).toBe("session.completed");
  });

  it("approval.requested uses risk: medium and category: command", () => {
    const step = happyPath.steps[1]!;
    const payload = step.event.payload as Record<string, unknown>;
    expect(payload["risk"]).toBe("medium");
    expect(payload["category"]).toBe("command");
  });

  it("steps are ordered by increasing delayMs", () => {
    const delays = happyPath.steps.map((s) => s.delayMs);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]!).toBeGreaterThanOrEqual(delays[i - 1]!);
    }
  });
});

describe("reconnect scenario", () => {
  it("has exactly 6 steps", () => {
    expect(reconnect.steps).toHaveLength(6);
  });

  it("contains a DISCONNECT sentinel event", () => {
    const disconnectStep = reconnect.steps.find((s) => s.event.type === "DISCONNECT");
    expect(disconnectStep).toBeDefined();
    expect(disconnectStep?.delayMs).toBe(400);
  });

  it("contains a RECONNECT sentinel event after DISCONNECT", () => {
    const disconnectIndex = reconnect.steps.findIndex(
      (s) => s.event.type === "DISCONNECT"
    );
    const reconnectIndex = reconnect.steps.findIndex(
      (s) => s.event.type === "RECONNECT"
    );
    expect(reconnectIndex).toBeGreaterThan(disconnectIndex);
  });

  it("approval is resolved after reconnect", () => {
    const reconnectIndex = reconnect.steps.findIndex(
      (s) => s.event.type === "RECONNECT"
    );
    const resolvedIndex = reconnect.steps.findIndex(
      (s) => s.event.type === "approval.resolved"
    );
    expect(resolvedIndex).toBeGreaterThan(reconnectIndex);
  });
});

describe("duplicate-command scenario", () => {
  it("has exactly 3 steps", () => {
    expect(duplicateCommand.steps).toHaveLength(3);
  });

  it("has two COMMAND_SEND steps with the same idempotencyKey", () => {
    const sends = duplicateCommand.steps.filter(
      (s) => s.event.type === "COMMAND_SEND"
    );
    expect(sends).toHaveLength(2);
    const keys = sends.map(
      (s) => (s.event.payload as Record<string, unknown>)["idempotencyKey"]
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it("second COMMAND_SEND expects result 'duplicate'", () => {
    const sends = duplicateCommand.steps.filter(
      (s) => s.event.type === "COMMAND_SEND"
    );
    const second = sends[1]!;
    const payload = second.event.payload as Record<string, unknown>;
    expect(payload["expectedResult"]).toBe("duplicate");
  });
});

describe("allScenarios", () => {
  it("all scenario IDs are unique", () => {
    const ids = allScenarios.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("contains all three scenarios", () => {
    const ids = allScenarios.map((s) => s.id);
    expect(ids).toContain("happy-path");
    expect(ids).toContain("reconnect");
    expect(ids).toContain("duplicate-command");
  });

  it("every scenario has at least one step", () => {
    for (const scenario of allScenarios) {
      expect(scenario.steps.length).toBeGreaterThan(0);
    }
  });

  it("every scenario has a non-empty description", () => {
    for (const scenario of allScenarios) {
      expect(scenario.description.length).toBeGreaterThan(0);
    }
  });
});
