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

export function discoverAgentDeckHosts(timeoutMs = 8000): Promise<DiscoveredHost[]> {
  return new Promise((resolve) => {
    const zeroconf = new Zeroconf();
    const hosts = new Map<string, DiscoveredHost>();
    const implementation = Platform.OS === "android" ? "DNSSD" : undefined;

    const onResolved = (service: ZeroconfService) => {
      const address = service.addresses?.find((value) => value.includes("."));
      const txt = service.txt ?? {};
      if (!address || !service.port || !txt.hostPublicKey) {
        return;
      }
      hosts.set(txt.hostId ?? service.name ?? address, {
        name: txt.hostName ?? service.name ?? "Agent Deck Host",
        url: `ws://${address}:${service.port}`,
        hostId: txt.hostId ?? "",
        hostPublicKey: txt.hostPublicKey,
      });
    };

    zeroconf.on("resolved", onResolved);
    zeroconf.on("error", () => undefined);
    zeroconf.scan("agent-deck", "tcp", "local.", implementation);

    const timer = setTimeout(() => {
      zeroconf.stop(implementation);
      zeroconf.removeDeviceListeners();
      resolve([...hosts.values()]);
    }, timeoutMs);

    void timer;
  });
}
