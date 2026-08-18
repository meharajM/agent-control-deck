import { Platform } from "react-native";
import Zeroconf from "react-native-zeroconf";

export interface DiscoveredHost {
  name: string;
  url: string;
  hostId: string;
  hostPublicKey: string;
}

type ZeroconfService = {
  name?: string;
  port?: number;
  addresses?: string[];
  txt?: Record<string, string>;
};

export const AGENT_DECK_SERVICE_TYPE = "agent-deck";

function formatWebSocketHost(address: string): string {
  // A URL needs brackets around an IPv6 literal. Zone identifiers are not
  // portable through the React Native WebSocket implementation, so prefer
  // IPv4 above and remove a link-local zone suffix for the fallback.
  if (!address.includes(":")) return address;
  return `[${address.split("%")[0]}]`;
}

export function toDiscoveredHost(service: ZeroconfService): DiscoveredHost | null {
  const address = service.addresses?.find((value) => value.includes("."))
    ?? service.addresses?.find((value) => value.includes(":"));
  const txt = service.txt ?? {};
  if (!address || !service.port || !txt.hostPublicKey) {
    return null;
  }

  return {
    name: txt.hostName ?? service.name ?? "Agent Deck Host",
    url: `ws://${formatWebSocketHost(address)}:${service.port}`,
    hostId: txt.hostId ?? "",
    hostPublicKey: txt.hostPublicKey,
  };
}

export function discoverAgentDeckHosts(timeoutMs = 8000): Promise<DiscoveredHost[]> {
  return new Promise((resolve) => {
    const zeroconf = new Zeroconf();
    const hosts = new Map<string, DiscoveredHost>();
    const implementation = Platform.OS === "android" ? "DNSSD" : undefined;

    const onResolved = (service: ZeroconfService) => {
      const host = toDiscoveredHost(service);
      if (!host) return;
      hosts.set(host.hostId || host.url, host);
    };

    zeroconf.on("resolved", onResolved);
    zeroconf.on("error", (error: unknown) => {
      // Discovery is convenience-only; keep the manual endpoint path usable
      // while retaining a useful diagnostic in development logs.
      if (__DEV__) console.warn("Agent Deck Bonjour discovery failed", error);
    });
    zeroconf.scan(AGENT_DECK_SERVICE_TYPE, "tcp", "local.", implementation);

    const timer = setTimeout(() => {
      zeroconf.stop(implementation);
      zeroconf.removeDeviceListeners();
      resolve([...hosts.values()]);
    }, timeoutMs);

    void timer;
  });
}
