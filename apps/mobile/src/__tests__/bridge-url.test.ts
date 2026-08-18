import { describe, expect, it } from "vitest";
import { normalizeBridgeUrl } from "../services/bridge-url";

describe("normalizeBridgeUrl", () => {
  it("accepts an IP address and port without requiring a scheme", () => {
    expect(normalizeBridgeUrl("192.168.1.20:8765")).toBe("ws://192.168.1.20:8765");
  });

  it("preserves secure WebSocket URLs", () => {
    expect(normalizeBridgeUrl("wss://bridge.example.test:443/")).toBe("wss://bridge.example.test");
  });

  it("rejects unsupported schemes and invalid ports", () => {
    expect(normalizeBridgeUrl("http://192.168.1.20:8765")).toBeNull();
    expect(normalizeBridgeUrl("192.168.1.20:70000")).toBeNull();
  });
});
