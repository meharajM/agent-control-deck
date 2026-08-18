import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { connectToBridge, disconnectFromBridge } from "../../services/bridge-connection";
import { normalizeBridgeUrl } from "../../services/bridge-url";
import { discoverAgentDeckHosts, type DiscoveredHost } from "../../services/host-discovery";
import {
  clearSavedBridgeConnection,
  saveBridgeConnection,
} from "../../services/bridge-preferences";
import {
  useConnectionStore,
  type PairingStatus,
} from "../../store/connection-store";
import { promptBiometric } from "../../services/command-sender";
import { isValidPairingCode, normalizePairingCode } from "../../services/pairing";
import { createMobileCrypto } from "../../services/mobile-crypto";

const LOCAL_SIMULATOR_BRIDGE_URL = "ws://127.0.0.1:8765";

export default function PairingScreen() {
  const [pairingCode, setPairingCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [selectedHost, setSelectedHost] = useState<DiscoveredHost | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const router = useRouter();
  const connStatus = useConnectionStore((s) => s.status);
  const errorMessage = useConnectionStore((s) => s.errorMessage);
  const pairingStatus = useConnectionStore((s) => s.pairingStatus);
  const hostName = useConnectionStore((s) => s.hostName);

  useEffect(() => {
    let active = true;
    void refreshHosts(() => active);
    return () => {
      active = false;
    };
  }, []);

  async function refreshHosts(isActive: () => boolean): Promise<void> {
    setDiscovering(true);
    const discovered = await discoverAgentDeckHosts();
    if (!isActive()) return;
    setHosts(discovered);
    setDiscovering(false);
  }

  useEffect(() => {
    if (connStatus === "connected") {
      setConnecting(false);
      router.replace("/(tabs)");
    } else if (connStatus === "failed") {
      setConnecting(false);
      useConnectionStore.getState().setPairingStatus("failed");
    } else if (connStatus === "reconnecting" || connStatus === "idle") {
      // A failed socket may briefly enter reconnecting before the retry limit.
      // Let the user correct the code or host instead of leaving Connect locked.
      setConnecting(false);
    }
  }, [connStatus, hostName, router]);

  async function handlePair() {
    Keyboard.dismiss();
    try {
      const input = pairingCode.trim();
      const normalized = __DEV__ && input.startsWith("ws") ? normalizeBridgeUrl(input) : null;
      const host = selectedHost ?? (hosts.length === 1 ? hosts[0] : null);
      if (!normalized && !host) {
        throw new Error(hosts.length === 0 ? "No Agent Deck host found on this network." : "Select a host before pairing.");
      }
      const connection = normalized
        ? { url: normalized }
        : {
            url: host!.url,
            hostPublicKey: host!.hostPublicKey,
            hostName: host!.name,
            pairingCode: input,
          };
      setPairingCode(normalized ?? input);
      setConnecting(true);
      useConnectionStore.getState().setPairingStatus("pairing");
      await saveBridgeConnection(connection);
      connectToBridge(
        connection.url,
        "hostPublicKey" in connection ? { ...connection, crypto: createMobileCrypto() } : {},
      );
    } catch (err) {
      setConnecting(false);
      useConnectionStore.getState().setPairingStatus("failed");
      Alert.alert("Invalid pairing code", err instanceof Error ? err.message : "Could not read the pairing code.");
      useConnectionStore.getState().onError(
        err instanceof Error ? err.message : "Could not connect to bridge.",
      );
    }
  }

  async function handleUnpair() {
    const biometricOk = await promptBiometric("Authenticate to unpair this host");
    if (!biometricOk) {
      Alert.alert("Authentication required", "Biometric authentication is required to unpair.");
      return;
    }
    disconnectFromBridge();
    void clearSavedBridgeConnection();
    Alert.alert("Unpaired", "This device has been unpaired from the host.");
  }

  const hasPairingInput = isValidPairingCode(pairingCode) || (__DEV__ && pairingCode.startsWith("ws"));
  const canPair = hasPairingInput && !connecting;
  const pairingHint = connecting
    ? "Connection attempt in progress"
    : !hasPairingInput
      ? "Enter the four digit pairing code first"
      : undefined;

  const statusLabel: Record<PairingStatus, string> = {
    not_paired: "Not paired",
    pairing: "Pairing...",
    paired: `Paired${hostName ? ` with ${hostName}` : ""}`,
    failed: "Pairing failed",
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text
          style={styles.heading}
          accessibilityRole="header"
          accessibilityLabel="Pair a host bridge"
        >
          Pair a Host
        </Text>

        {/* Pairing status */}
        <View
          style={styles.statusRow}
          accessibilityLabel={`Pairing status: ${statusLabel[pairingStatus]}`}
          accessibilityRole="text"
        >
          <View
            style={[
              styles.statusDot,
              pairingStatus === "paired" && styles.statusDotGreen,
              pairingStatus === "pairing" && styles.statusDotYellow,
              pairingStatus === "failed" && styles.statusDotRed,
            ]}
          />
          <Text style={styles.statusText}>{statusLabel[pairingStatus]}</Text>
        </View>

        <Text style={styles.description}>
          Open Agent Deck Host on your computer, then enter the 4-digit code it shows.
        </Text>

        {connStatus === "failed" || errorMessage ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {errorMessage ?? "Connection failed. Check the URL and bridge status."}
          </Text>
        ) : null}

        <TextInput
          style={styles.input}
          value={pairingCode}
          onChangeText={(value) => setPairingCode(normalizePairingCode(value))}
          placeholder="0000"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          maxLength={__DEV__ ? 64 : 4}
          textAlign="center"
          returnKeyType="done"
          onSubmitEditing={handlePair}
          accessibilityLabel="Agent Deck pairing code"
          accessibilityHint="Enter the four digit code shown by Agent Deck Host"
        />

        <Text style={styles.discoveryText} accessibilityRole="text">
          {discovering ? "Looking for computers..." : hosts.length === 0 ? "No computer found yet" : `${hosts.length} computer${hosts.length === 1 ? "" : "s"} found`}
        </Text>

        {hosts.map((host) => (
          <Pressable
            key={host.hostId || host.url}
            style={[styles.hostBtn, selectedHost?.url === host.url && styles.hostBtnSelected]}
            onPress={() => setSelectedHost(host)}
            accessibilityRole="button"
            accessibilityLabel={`Select ${host.name}`}
            accessibilityState={{ selected: selectedHost?.url === host.url }}
          >
            <Text style={styles.hostBtnText}>{host.name}</Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.devBridgeBtn}
          onPress={() => void refreshHosts(() => true)}
          accessibilityLabel="Find computers"
          accessibilityRole="button"
        >
          <Text style={styles.devBridgeBtnText}>{discovering ? "Searching..." : "Find Computers"}</Text>
        </Pressable>

        {__DEV__ ? (
          <Pressable
            style={styles.devBridgeBtn}
            onPress={() => setPairingCode(LOCAL_SIMULATOR_BRIDGE_URL)}
            accessibilityLabel="Use local simulator bridge"
            accessibilityRole="button"
            accessibilityHint="Fills the localhost bridge URL used by the Android simulator development workflow"
          >
            <Text style={styles.devBridgeBtnText}>Use Local Simulator Bridge</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.pairBtn, !canPair && styles.pairBtnDisabled]}
          onPress={canPair ? handlePair : undefined}
          accessibilityLabel="Connect to host"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPair }}
          accessibilityHint={pairingHint}
        >
          <Text style={styles.pairBtnText}>
            {connecting || connStatus === "connecting" ? "Connecting..." : "Connect"}
          </Text>
        </Pressable>

        {/* Unpair button — only shown when paired */}
        {pairingStatus === "paired" && (
          <Pressable
            style={styles.unpairBtn}
            onPress={handleUnpair}
            accessibilityLabel="Unpair from host"
            accessibilityRole="button"
            accessibilityHint="Requires biometric authentication"
          >
            <Text style={styles.unpairBtnText}>Unpair</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  inner: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { fontSize: 26, fontWeight: "700", color: "#111", marginBottom: 12 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#aaa",
    marginRight: 8,
  },
  statusDotGreen: { backgroundColor: "#34c759" },
  statusDotYellow: { backgroundColor: "#ff9500" },
  statusDotRed: { backgroundColor: "#ff3b30" },
  statusText: { fontSize: 14, color: "#333", fontWeight: "500" },
  description: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
  },
  discoveryText: { color: "#666", fontSize: 13, marginBottom: 12 },
  hostBtn: { width: "100%", minHeight: 48, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, justifyContent: "center", paddingHorizontal: 14, marginBottom: 8, backgroundColor: "#fff" },
  hostBtnSelected: { borderColor: "#1a73e8", backgroundColor: "#eef5ff" },
  hostBtnText: { color: "#222", fontSize: 15, fontWeight: "600" },
  input: {
    width: "100%",
    minHeight: 120,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111",
    marginBottom: 16,
  },
  devBridgeBtn: {
    minHeight: 48,
    width: "100%",
    borderWidth: 1,
    borderColor: "#8a8a8a",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  devBridgeBtnText: { color: "#444", fontSize: 15, fontWeight: "600" },
  pairBtn: {
    width: "100%",
    height: 52,
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pairBtnDisabled: { backgroundColor: "#ccc" },
  pairBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  unpairBtn: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#ff3b30",
    borderRadius: 8,
  },
  unpairBtnText: { color: "#ff3b30", fontSize: 15, fontWeight: "600" },
  errorText: { width: "100%", marginTop: 14, color: "#b3261e", fontSize: 14, lineHeight: 20 },
});
