import { create } from "zustand";

export type WsStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export interface ConnectionState {
  status: WsStatus;
  bridgeUrl: string | null;
  hostId: string | null;
  reconnectAttempts: number;

  // --- actions ---
  connect(url: string): void;
  disconnect(): void;
  onConnected(hostId: string): void;
  onDisconnected(): void;
  onError(): void;
  incrementReconnectAttempts(): void;
  resetReconnectAttempts(): void;
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  status: "idle",
  bridgeUrl: null,
  hostId: null,
  reconnectAttempts: 0,

  connect(url: string) {
    set({ status: "connecting", bridgeUrl: url, hostId: null });
  },

  disconnect() {
    set({ status: "idle", hostId: null, reconnectAttempts: 0 });
  },

  onConnected(hostId: string) {
    set({ status: "connected", hostId, reconnectAttempts: 0 });
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
}));
