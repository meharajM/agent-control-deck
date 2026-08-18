import * as SecureStore from "expo-secure-store";

const BRIDGE_CONNECTION_KEY = "agentdeck_bridge_connection";

export interface SavedBridgeConnection {
  url: string;
  hostPublicKey?: string;
  pairingNonce?: string;
  pairingCode?: string;
  hostName?: string;
}

export async function loadSavedBridgeConnection(): Promise<SavedBridgeConnection | null> {
  try {
    const raw = await SecureStore.getItemAsync(BRIDGE_CONNECTION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const value = parsed as Record<string, unknown>;
    if (typeof value.url !== "string") return null;
    return {
      url: value.url,
      ...(typeof value.hostPublicKey === "string" ? { hostPublicKey: value.hostPublicKey } : {}),
      ...(typeof value.pairingNonce === "string" ? { pairingNonce: value.pairingNonce } : {}),
      ...(typeof value.pairingCode === "string" ? { pairingCode: value.pairingCode } : {}),
      ...(typeof value.hostName === "string" ? { hostName: value.hostName } : {}),
    };
  } catch {
    return null;
  }
}

export async function saveBridgeConnection(connection: SavedBridgeConnection): Promise<void> {
  await SecureStore.setItemAsync(BRIDGE_CONNECTION_KEY, JSON.stringify(connection));
}

export async function clearSavedBridgeConnection(): Promise<void> {
  await SecureStore.deleteItemAsync(BRIDGE_CONNECTION_KEY);
}
