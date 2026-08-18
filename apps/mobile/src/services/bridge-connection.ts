import { useConnectionStore } from "../store/connection-store";
import { useSessionStore } from "../store/session-store";
import { UcpClient, type UcpClientCallbacks, type UcpClientCrypto } from "./ucp-client";
import { DiagnosticsTracker } from "./route-diagnostics";
import type { RouteConfig } from "./route-selection";

let client: UcpClient | null = null;
let diagnosticsTimer: ReturnType<typeof setInterval> | null = null;
const diagnosticsTracker = new DiagnosticsTracker();

const DIAGNOSTICS_INTERVAL_MS = 5000;

export interface BridgeConnectionOptions {
  hostPublicKey?: string;
  pairingNonce?: string;
  pairingCode?: string;
  hostName?: string;
  crypto?: UcpClientCrypto;
}

export function connectToBridge(url: string, options: BridgeConnectionOptions = {}): void {
  if (client !== null) {
    client.disconnect();
  }

  const store = useConnectionStore.getState();
  const networkId = getNetworkId();
  const route = store.selectBestRoute({
    directEndpoint: url,
    privateEndpoint: null,
    lastSuccessfulRoute: networkId ? (store.routeMemory[networkId] ?? null) : null,
    lastNetworkId: networkId,
  });
  const endpoint = route?.selectedEndpoint ?? url;

  const callbacks: UcpClientCallbacks = {
    onEvent(event) {
      // Track latency for command.ack events
      if (event.type === "command.ack") {
        // ponytail: rough latency estimate — real implementation would
        // match correlationId to sent timestamp; this is good enough for MVP
        diagnosticsTracker.recordLatency(50);
      }
      useSessionStore.getState().applyEvent(event);
    },
    onConnected(hostId, hostName) {
      const store = useConnectionStore.getState();
      useSessionStore.getState().setConnectionStatus("connected");
      store.onConnected(hostId);
      if (hostName) store.setHostName(hostName);

      // Record route success
      const route = store.selectedRoute;
      if (route) {
        const networkId = getNetworkId();
        store.recordRouteSuccess(route.selectedEndpoint, networkId);
        diagnosticsTracker.startTracking(route.routeType, route.selectedEndpoint);
        startDiagnosticsTimer();
      }
    },
    onDisconnected() {
      const store = useConnectionStore.getState();
      useSessionStore.getState().markStale();
      store.onDisconnected();
      diagnosticsTracker.recordReconnect("socket disconnected");
      stopDiagnosticsTimer();

      // Attempt route fallback if auto-fallback is enabled
      if (store.autoFallbackEnabled) {
        const selectedRoute = store.selectedRoute;
        if (selectedRoute) {
          store.recordRouteFailure(endpoint, selectedRoute.routeType);
          attemptFallback();
        }
      }
    },
    onError(err) {
      const store = useConnectionStore.getState();
      useSessionStore.getState().markStale();
      store.onError(err.message);
      diagnosticsTracker.recordReconnect(err.message);
      stopDiagnosticsTimer();

      if (store.autoFallbackEnabled) {
        const selectedRoute = store.selectedRoute;
        if (selectedRoute) {
          store.recordRouteFailure(endpoint, selectedRoute.routeType);
          attemptFallback();
        }
      }
    },
  };

  store.connect(endpoint);
  useSessionStore.getState().setConnectionStatus("connecting");
  client = new UcpClient(endpoint, callbacks, {
    ...options,
    getLastSyncSequence: () => useSessionStore.getState().lastSyncSequence,
  });
  client.connect();
}

export function disconnectFromBridge(): void {
  stopDiagnosticsTimer();
  if (client !== null) {
    client.disconnect();
    client = null;
  }
  diagnosticsTracker.reset();
  useSessionStore.getState().reset();
  useConnectionStore.getState().disconnect();
}

export function sendCommand(type: string, payload: unknown): void {
  if (client === null || client.getStatus() !== "connected") {
    throw new Error("Cannot send command: not connected to bridge");
  }
  client.send(type, payload);
}

export function getDiagnostics() {
  return diagnosticsTracker.getDiagnostics();
}

export function getNetworkId(): string | null {
  // ponytail: stub — React Native NetInfo would provide real SSID
  // For now, return a placeholder that enables route memory per-network
  return "default-network";
}

function startDiagnosticsTimer(): void {
  stopDiagnosticsTimer();
  useConnectionStore.getState().setDiagnostics(diagnosticsTracker.getDiagnostics());
  diagnosticsTimer = setInterval(() => {
    const diag = diagnosticsTracker.getDiagnostics();
    useConnectionStore.getState().setDiagnostics(diag);
  }, DIAGNOSTICS_INTERVAL_MS);
}

function stopDiagnosticsTimer(): void {
  if (diagnosticsTimer !== null) {
    clearInterval(diagnosticsTimer);
    diagnosticsTimer = null;
  }
}

function attemptFallback(): void {
  const store = useConnectionStore.getState();
  const networkId = getNetworkId();
  const config: RouteConfig = {
    directEndpoint: store.bridgeUrl,
    privateEndpoint: null, // Read from secure store in real impl
    lastSuccessfulRoute: networkId ? (store.routeMemory[networkId] ?? null) : null,
    lastNetworkId: networkId,
  };

  const selection = store.selectBestRoute(config);
  if (selection && selection.selectedEndpoint !== store.bridgeUrl) {
    // Disconnect current and reconnect via new route
    if (client !== null) {
      client.disconnect();
      client = null;
    }
    connectToBridge(selection.selectedEndpoint);
  }
}
