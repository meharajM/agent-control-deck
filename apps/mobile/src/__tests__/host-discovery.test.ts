import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("react-native-zeroconf", () => ({
  default: class Zeroconf {},
}));

import { toDiscoveredHost } from "../services/host-discovery";

describe("toDiscoveredHost", () => {
  it("maps the bridge Bonjour TXT record to a connectable IPv4 endpoint", () => {
    expect(toDiscoveredHost({
      name: "Agent Deck Bridge",
      port: 8765,
      addresses: ["192.168.29.137"],
      txt: {
        hostId: "host-1",
        hostName: "Development Mac",
        hostPublicKey: "host-key",
      },
    })).toEqual({
      name: "Development Mac",
      url: "ws://192.168.29.137:8765",
      hostId: "host-1",
      hostPublicKey: "host-key",
    });
  });

  it("keeps an IPv6-only service discoverable", () => {
    expect(toDiscoveredHost({
      name: "Agent Deck Bridge",
      port: 8765,
      addresses: ["fe80::1%en0"],
      txt: { hostPublicKey: "host-key" },
    })?.url).toBe("ws://[fe80::1]:8765");
  });

  it("ignores services without the bridge authentication key", () => {
    expect(toDiscoveredHost({
      name: "Unrelated Service",
      port: 80,
      addresses: ["192.168.29.137"],
      txt: {},
    })).toBeNull();
  });
});
