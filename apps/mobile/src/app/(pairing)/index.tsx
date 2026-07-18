import { useState } from "react";
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

/**
 * Pairing screen — placeholder for QR scan + manual URL entry.
 *
 * The full pairing flow (camera QR, cryptographic handshake, fingerprint
 * confirmation) is deferred to the security/networking agent task.
 * This scaffold provides the manual-URL entry path which is usable in
 * development and in no-camera environments.
 */
export default function PairingScreen() {
  const [bridgeUrl, setBridgeUrl] = useState("");

  function handlePair() {
    Keyboard.dismiss();
    // ponytail: actual UcpClient.connect() wired here once paired-device
    // credential flow is available (security agent task).
    // For now: validate the URL format and show feedback.
  }

  const canPair = bridgeUrl.startsWith("ws://") || bridgeUrl.startsWith("wss://");

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

        <Text style={styles.description}>
          Scan the QR code shown by the host bridge, or enter its address
          manually.
        </Text>

        {/* QR scanner placeholder */}
        <View
          style={styles.qrPlaceholder}
          accessibilityLabel="QR code scanner — camera required"
          accessibilityRole="image"
          accessibilityHint="Camera pairing will be available after permissions are granted"
        >
          <Text style={styles.qrPlaceholderText}>QR scan (coming soon)</Text>
        </View>

        <Text
          style={styles.orLabel}
          accessibilityRole="text"
        >
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
          <Text style={styles.pairBtnText}>Connect</Text>
        </Pressable>
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
  description: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    backgroundColor: "#fff",
  },
  qrPlaceholderText: { color: "#aaa", fontSize: 14 },
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
});
