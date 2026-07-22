import { useState } from "react";
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
import { connectToBridge, disconnectFromBridge } from "../../services/bridge-connection.js";
import {
  useConnectionStore,
  type PairingStatus,
} from "../../store/connection-store.js";
import { promptBiometric } from "../../services/command-sender.js";

export default function PairingScreen() {
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const router = useRouter();
  const connStatus = useConnectionStore((s) => s.status);
  const pairingStatus = useConnectionStore((s) => s.pairingStatus);
  const hostName = useConnectionStore((s) => s.hostName);

  function handlePair() {
    Keyboard.dismiss();
    setConnecting(true);
    try {
      connectToBridge(bridgeUrl);
      router.push("/sessions");
    } catch (err) {
      Alert.alert("Connection failed", err instanceof Error ? err.message : "Could not connect to bridge.");
    } finally {
      setConnecting(false);
    }
  }

  function handleScanQr() {
    router.push("/(pairing)/scan");
  }

  async function handleUnpair() {
    const biometricOk = await promptBiometric("Authenticate to unpair this host");
    if (!biometricOk) {
      Alert.alert("Authentication required", "Biometric authentication is required to unpair.");
      return;
    }
    disconnectFromBridge();
    Alert.alert("Unpaired", "This device has been unpaired from the host.");
  }

  const canPair =
    (bridgeUrl.startsWith("ws://") || bridgeUrl.startsWith("wss://")) &&
    !connecting &&
    connStatus !== "connecting";

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
          Scan the QR code shown by the host bridge, or enter its address
          manually.
        </Text>

        {/* QR scanner button */}
        <Pressable
          style={styles.qrBtn}
          onPress={handleScanQr}
          accessibilityLabel="Scan host QR code to pair"
          accessibilityRole="button"
          accessibilityHint="Opens camera to scan a QR code from the host bridge"
        >
          <Text style={styles.qrBtnText}>Scan QR Code</Text>
        </Pressable>

        <Text style={styles.orLabel} accessibilityRole="text">
          — or enter manually —
        </Text>

        <TextInput
          style={styles.input}
          value={bridgeUrl}
          onChangeText={setBridgeUrl}
          placeholder="ws://192.168.1.x:8765"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={handlePair}
          accessibilityLabel="Bridge WebSocket URL"
          accessibilityHint="Enter the address shown by the host bridge, starting with ws:// or wss://"
        />

        <Pressable
          style={[styles.pairBtn, !canPair && styles.pairBtnDisabled]}
          onPress={canPair ? handlePair : undefined}
          accessibilityLabel="Connect to host"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canPair }}
          accessibilityHint={
            canPair ? undefined : "Enter a valid ws:// or wss:// address first"
          }
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
  qrBtn: {
    width: "100%",
    height: 52,
    backgroundColor: "#34c759",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  qrBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  orLabel: { fontSize: 13, color: "#888", marginBottom: 16 },
  input: {
    width: "100%",
    height: 48,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111",
    marginBottom: 16,
  },
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
});
