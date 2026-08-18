import { describe, expect, it } from "vitest";
import { DiagnosticsTracker } from "../services/route-diagnostics.js";

describe("DiagnosticsTracker", () => {
  it("clears reconnect state when a new connection starts tracking", () => {
    const tracker = new DiagnosticsTracker();

    tracker.startTracking("direct", "ws://localhost:8765");
    tracker.recordReconnect("socket disconnected");
    tracker.recordReconnect("retrying");

    tracker.startTracking("private", "ws://100.64.0.1:8765");

    expect(tracker.getDiagnostics()).toMatchObject({
      routeType: "private",
      endpoint: "ws://100.64.0.1:8765",
      reconnectCount: 0,
      lastReconnectReason: "",
    });
  });
});
