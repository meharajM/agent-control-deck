import { useConnectionStore } from "../store/connection-store.js";
import { useSessionStore } from "../store/session-store.js";
import { UcpClient, type UcpClientCallbacks } from "./ucp-client.js";
import { DiagnosticsTracker } from "./route-diagnostics.js";
import type { RouteConfig } from "./route-selection.js";

let client: UcpClient | null = null;
let diagnosticsTimer: ReturnType<typeof setInterval> | null = null;
const diagnosticsTracker = new DiagnosticsTracker();

const DIAGNOSTICS_INTERVAL_MS = 5000;

export function connectToBridge(url: string): void {
  if (client !== null) {
    client.disconnect();
  }

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
    onConnected(hostId) {
      const store = useConnectionStore.getState();
      useSessionStore.getState().setConnectionStatus("connected");
      store.onConnected(hostId);

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
        const route = store.selectedRoute;
        if (route) {
          store.recordRouteFailure(url, route.routeType);
          attemptFallback();
        }
      }
    },
    onError(err) {
      const store = useConnectionStore.getState();
      useSessionStore.getState().markStale();
      store.onError();
      diagnosticsTracker.recordReconnect(err.message);
      stopDiagnosticsTimer();

      if (store.autoFallbackEnabled) {
        const route = store.selectedRoute;
        if (route) {
          store.recordRouteFailure(url, route.routeType);
          attemptFallback();
        }
      }
    },
  };

  client = new UcpClient(url, callbacks);
  useConnectionStore.getState().connect(url);
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
