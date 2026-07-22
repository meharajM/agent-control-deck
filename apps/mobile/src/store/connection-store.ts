import { create } from "zustand";
import type { RouteType, RouteSelection, RouteConfig } from "../services/route-selection.js";
import { selectRoute } from "../services/route-selection.js";
import type { RouteDiagnostics } from "../services/route-diagnostics.js";

export type WsStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export type PairingStatus = "not_paired" | "pairing" | "paired" | "failed";

export interface ConnectionState {
  status: WsStatus;
  pairingStatus: PairingStatus;
  bridgeUrl: string | null;
  hostId: string | null;
  hostName: string | null;
  devicePublicKey: string | null;
  reconnectAttempts: number;

  // --- route state ---
  routeType: RouteType;
  routeMemory: Record<string, string>; // networkId → last successful endpoint
  directFailures: number;
  privateFailures: number;
  selectedRoute: RouteSelection | null;
  autoFallbackEnabled: boolean;
  diagnostics: RouteDiagnostics | null;

  // --- actions ---
  connect(url: string): void;
  disconnect(): void;
  onConnected(hostId: string): void;
  onDisconnected(): void;
  onError(): void;
  incrementReconnectAttempts(): void;
  resetReconnectAttempts(): void;
  setPairingStatus(status: PairingStatus): void;
  setDevicePublicKey(key: string): void;
  setHostName(name: string): void;

  selectBestRoute(config: RouteConfig): RouteSelection | null;
  recordRouteSuccess(endpoint: string, networkId: string | null): void;
  recordRouteFailure(endpoint: string, routeType: RouteType): void;
  resetRouteFailures(): void;
  setDiagnostics(diagnostics: RouteDiagnostics | null): void;
  setRouteType(routeType: RouteType): void;
  setSelectedRoute(route: RouteSelection | null): void;
  setAutoFallback(enabled: boolean): void;
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  status: "idle",
  pairingStatus: "not_paired",
  bridgeUrl: null,
  hostId: null,
  hostName: null,
  devicePublicKey: null,
  reconnectAttempts: 0,

  routeType: "direct",
  routeMemory: {},
  directFailures: 0,
  privateFailures: 0,
  selectedRoute: null,
  autoFallbackEnabled: true,
  diagnostics: null,

  connect(url: string) {
    set({ status: "connecting", bridgeUrl: url, hostId: null });
  },

  disconnect() {
    set({
      status: "idle",
      hostId: null,
      reconnectAttempts: 0,
      diagnostics: null,
      directFailures: 0,
      privateFailures: 0,
    });
  },

  onConnected(hostId: string) {
    set({ status: "connected", hostId, reconnectAttempts: 0, pairingStatus: "paired" });
  },

  onDisconnected() {
    set({
      status: "reconnecting",
      hostId: null,
    });
  },

  onError() {
    set({ status: "failed" });
  },

  incrementReconnectAttempts() {
    set((s) => ({ reconnectAttempts: s.reconnectAttempts + 1 }));
  },

  resetReconnectAttempts() {
    set({ reconnectAttempts: 0 });
  },

  setPairingStatus(status: PairingStatus) {
    set({ pairingStatus: status });
  },

  setDevicePublicKey(key: string) {
    set({ devicePublicKey: key });
  },

  setHostName(name: string) {
    set({ hostName: name });
  },

  selectBestRoute(config: RouteConfig) {
    const state = get();
    const selection = selectRoute(config, state.directFailures, state.privateFailures);
    if (selection) {
      set({ selectedRoute: selection, routeType: selection.routeType });
    } else {
      set({ selectedRoute: null });
    }
    return selection;
  },

  recordRouteSuccess(endpoint: string, networkId: string | null) {
    set((s) => ({
      directFailures: 0,
      privateFailures: 0,
      routeMemory: networkId
        ? { ...s.routeMemory, [networkId]: endpoint }
        : s.routeMemory,
    }));
  },

  recordRouteFailure(endpoint: string, routeType: RouteType) {
    set((s) => ({
      directFailures:
        routeType === "direct" ? s.directFailures + 1 : s.directFailures,
      privateFailures:
        routeType === "private" ? s.privateFailures + 1 : s.privateFailures,
    }));
  },

  resetRouteFailures() {
    set({ directFailures: 0, privateFailures: 0 });
  },

  setDiagnostics(diagnostics: RouteDiagnostics | null) {
    set({ diagnostics });
  },

  setRouteType(routeType: RouteType) {
    set({ routeType });
  },

  setSelectedRoute(route: RouteSelection | null) {
    set({ selectedRoute: route });
  },

  setAutoFallback(enabled: boolean) {
    set({ autoFallbackEnabled: enabled });
  },
}));
