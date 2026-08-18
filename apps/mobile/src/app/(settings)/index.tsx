import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useConnectionStore } from "../../store/connection-store";
import { validatePrivateEndpoint } from "../../services/route-selection";

const PRIVATE_ENDPOINT_KEY = "agentdeck_private_endpoint";
const AUTO_FALLBACK_KEY = "agentdeck_auto_fallback";

async function loadPrivateEndpoint(): Promise<string> {
  return (await SecureStore.getItemAsync(PRIVATE_ENDPOINT_KEY)) ?? "";
}

async function savePrivateEndpoint(endpoint: string): Promise<void> {
  if (endpoint) {
    await SecureStore.setItemAsync(PRIVATE_ENDPOINT_KEY, endpoint);
  } else {
    await SecureStore.deleteItemAsync(PRIVATE_ENDPOINT_KEY);
  }
}

async function loadAutoFallback(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(AUTO_FALLBACK_KEY);
  return val !== "false";
}

async function saveAutoFallback(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(AUTO_FALLBACK_KEY, String(enabled));
}

export default function SettingsScreen() {
  const autoFallback = useConnectionStore((s) => s.autoFallbackEnabled);
  const setAutoFallback = useConnectionStore((s) => s.setAutoFallback);

  const [endpoint, setEndpoint] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingEndpoint, setSavingEndpoint] = useState(false);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const testResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingResultTimer = useCallback(() => {
    if (testResultTimerRef.current !== null) {
      clearTimeout(testResultTimerRef.current);
      testResultTimerRef.current = null;
    }
  }, []);

  const showTemporaryResult = useCallback(
    (result: string, durationMs = 2000) => {
      clearPendingResultTimer();
      setTestResult(result);
      testResultTimerRef.current = setTimeout(() => {
        setTestResult(null);
        testResultTimerRef.current = null;
      }, durationMs);
    },
    [clearPendingResultTimer],
  );

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      const [storedEndpoint, storedAutoFallback] = await Promise.all([
        loadPrivateEndpoint(),
        loadAutoFallback(),
      ]);

      if (!active) {
        return;
      }

      setEndpoint(storedEndpoint);
      setAutoFallback(storedAutoFallback);
      setLoaded(true);
    }

    void loadSettings();

    return () => {
      active = false;
      clearPendingResultTimer();
    };
  }, [clearPendingResultTimer, setAutoFallback]);

  const handleSaveEndpoint = useCallback(async () => {
    if (!loaded || savingEndpoint) {
      return;
    }

    const trimmed = endpoint.trim();
    setSavingEndpoint(true);

    try {
      if (!trimmed) {
        await savePrivateEndpoint("");
        Alert.alert("Cleared", "Private endpoint removed.");
        return;
      }

      const error = validatePrivateEndpoint(trimmed);
      if (error) {
        Alert.alert("Invalid endpoint", error);
        return;
      }

      await savePrivateEndpoint(trimmed);
      Alert.alert("Saved", `Private endpoint set to ${trimmed}`);
    } finally {
      setSavingEndpoint(false);
    }
  }, [endpoint, loaded, savingEndpoint]);

  const handleTestEndpoint = useCallback(() => {
    if (!loaded || testingEndpoint) {
      return;
    }

    const trimmed = endpoint.trim();
    if (!trimmed) {
      showTemporaryResult("No endpoint configured");
      return;
    }

    const error = validatePrivateEndpoint(trimmed);
    if (error) {
      showTemporaryResult("Invalid");
      return;
    }

    clearPendingResultTimer();
    setTestingEndpoint(true);
    setTestResult("Testing...");
    testResultTimerRef.current = setTimeout(() => {
      setTestingEndpoint(false);
      testResultTimerRef.current = null;
      showTemporaryResult("Format OK");
    }, 1000);
  }, [clearPendingResultTimer, endpoint, loaded, showTemporaryResult, testingEndpoint]);

  const handleDeleteEndpoint = useCallback(() => {
    if (!loaded || savingEndpoint || testingEndpoint) {
      return;
    }

    Alert.alert("Delete Endpoint", "Remove private endpoint?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          clearPendingResultTimer();
          setEndpoint("");
          setTestResult(null);
          await savePrivateEndpoint("");
          showTemporaryResult("Deleted");
        },
      },
    ]);
  }, [
    clearPendingResultTimer,
    loaded,
    savingEndpoint,
    showTemporaryResult,
    testingEndpoint,
  ]);

  const handleToggleFallback = useCallback(
    async (value: boolean) => {
      setAutoFallback(value);
      await saveAutoFallback(value);
    },
    [setAutoFallback],
  );

  const controlsDisabled = !loaded || savingEndpoint || testingEndpoint;
  const statusText = !loaded ? "Loading saved settings..." : testResult;

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Private Endpoint</Text>
        <TextInput
          style={styles.input}
          value={endpoint}
          onChangeText={(value) => {
            clearPendingResultTimer();
            setEndpoint(value);
            if (testResult !== null) {
              setTestResult(null);
            }
          }}
          placeholder="100.64.0.1:8765"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!controlsDisabled}
          accessibilityLabel="Private network endpoint in host port format"
        />
        <Text style={styles.hint}>
          Tailscale or WireGuard IP with port. Cannot be localhost.
        </Text>

        {statusText ? (
          <Text style={styles.statusText} accessibilityLiveRegion="polite">
            {statusText}
          </Text>
        ) : null}

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, styles.saveButton, controlsDisabled && styles.buttonDisabled]}
            onPress={controlsDisabled ? undefined : handleSaveEndpoint}
            accessibilityLabel="Save private endpoint"
            accessibilityRole="button"
            accessibilityState={{ disabled: controlsDisabled }}
          >
            <Text style={styles.buttonText}>{savingEndpoint ? "Saving..." : "Save"}</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.testButton, controlsDisabled && styles.buttonDisabled]}
            onPress={controlsDisabled ? undefined : handleTestEndpoint}
            accessibilityLabel="Test private endpoint connection"
            accessibilityRole="button"
            accessibilityState={{ disabled: controlsDisabled }}
          >
            <Text style={styles.buttonText}>{testingEndpoint ? "Testing..." : "Test"}</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.deleteButton, controlsDisabled && styles.buttonDisabled]}
            onPress={controlsDisabled ? undefined : handleDeleteEndpoint}
            accessibilityLabel="Delete private endpoint"
            accessibilityRole="button"
            accessibilityState={{ disabled: controlsDisabled }}
          >
            <Text style={styles.buttonText}>Delete</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabel}>
            <Text style={styles.toggleTitle}>Auto-fallback to Private</Text>
            <Text style={styles.toggleHint}>
              After 3 direct failures, try private endpoint
            </Text>
          </View>
          <Switch
            value={autoFallback}
            onValueChange={handleToggleFallback}
            accessibilityLabel="Toggle auto fallback to private endpoint"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "monospace",
  },
  hint: {
    fontSize: 12,
    color: "#888",
    marginTop: 6,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 13,
    color: "#555",
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  saveButton: { backgroundColor: "#1a73e8" },
  testButton: { backgroundColor: "#555" },
  deleteButton: { backgroundColor: "#c62828" },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleLabel: { flex: 1, marginRight: 12 },
  toggleTitle: { fontSize: 15, color: "#333" },
  toggleHint: { fontSize: 12, color: "#888", marginTop: 2 },
});
