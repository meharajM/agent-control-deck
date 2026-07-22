import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { connectToBridge } from "../../services/bridge-connection.js";
import { useConnectionStore } from "../../store/connection-store.js";

/**
 * Decode a scanned QR payload and initiate pairing.
 * The QR payload format is JSON with hostId, hostPublicKey, endpoints, nonce, expiresAt.
 */
function handleQrScan(
  data: string,
  router: ReturnType<typeof useRouter>,
  setPairingStatus: (s: "pairing" | "failed") => void,
): void {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data);
  } catch {
    Alert.alert("Invalid QR Code", "This does not appear to be an Agent Deck pairing code.");
    return;
  }

  if (parsed.v !== 1) {
    Alert.alert("Unsupported Version", "Please update the host bridge and try again.");
    return;
  }

  if (typeof parsed.expiresAt === "string") {
    const expiresAt = new Date(parsed.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      Alert.alert("QR Code Expired", "Please ask the host to generate a new QR code.");
      return;
    }
  }

  const endpoints = parsed.endpoints as string[] | undefined;
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    Alert.alert("Invalid QR Code", "No endpoints found in QR code.");
    return;
  }

  const hostPublicKey = parsed.hostPublicKey as string | undefined;
  if (!hostPublicKey) {
    Alert.alert("Invalid QR Code", "Missing host public key.");
    return;
  }

  // Use the first endpoint
  const wsUrl = endpoints[0] as string;

  setPairingStatus("pairing");
  try {
    connectToBridge(wsUrl);
    router.push("/sessions");
  } catch (err) {
    setPairingStatus("failed");
    Alert.alert("Connection failed", err instanceof Error ? err.message : "Could not connect to host.");
  }
}

export default function QrScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const setPairingStatus = useConnectionStore((s) => s.setPairingStatus);
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText} accessibilityLabel="Loading camera permissions">
          Loading...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message} accessibilityRole="text">
          Camera permission is required to scan QR codes.
        </Text>
        <Text
          style={styles.link}
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
        >
          Grant Permission
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : (event) => {
          setScanned(true);
          handleQrScan(event.data, router, setPairingStatus);
        }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        accessibilityLabel="Scan host QR code to pair"
      />
      <View style={styles.overlay}>
        <Text style={styles.instruction} accessibilityRole="text">
          Point camera at host QR code
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f5f5",
  },
  overlay: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  instruction: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  message: { fontSize: 16, color: "#333", textAlign: "center", marginBottom: 16 },
  link: { fontSize: 16, color: "#1a73e8", fontWeight: "700" },
  loadingText: { fontSize: 16, color: "#888" },
});
