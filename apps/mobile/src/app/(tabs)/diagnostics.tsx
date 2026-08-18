import { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useConnectionStore } from "../../store/connection-store";
import { useSessionStore } from "../../store/session-store";
import { sendCommand } from "../../services/bridge-connection";

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function latencyColor(ms: number): string {
  if (ms < 100) return "#2e7d32";
  if (ms < 500) return "#f5a623";
  return "#c62828";
}

function routeTypeBadge(type: string): { label: string; color: string } {
  switch (type) {
    case "direct":
      return { label: "Direct LAN", color: "#2e7d32" };
    case "private":
      return { label: "Private", color: "#1565c0" };
    case "relay":
      return { label: "Relay", color: "#6a1b9a" };
    default:
      return { label: "Unknown", color: "#888" };
  }
}

export default function DiagnosticsScreen() {
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const diagnostics = useConnectionStore((s) => s.diagnostics);
  const selectedRoute = useConnectionStore((s) => s.selectedRoute);
  const directFailures = useConnectionStore((s) => s.directFailures);
  const privateFailures = useConnectionStore((s) => s.privateFailures);
  const [pingResult, setPingResult] = useState<string | null>(null);

  const isConnected = connectionStatus === "connected";
  const isStale = connectionStatus === "stale";
  const isDisconnected = connectionStatus === "disconnected";
  const statusLabel = isConnected
    ? "Connected"
    : isStale
      ? "Offline (cached data)"
      : "Disconnected";

  const handleTestConnection = useCallback(() => {
    if (!isConnected) {
      setPingResult("Reconnect required");
      setTimeout(() => setPingResult(null), 2000);
      return;
    }
    try {
      sendCommand("host.get_diagnostics", {});
      setPingResult("Sent");
      setTimeout(() => setPingResult(null), 2000);
    } catch {
      setPingResult("Failed");
      setTimeout(() => setPingResult(null), 2000);
    }
  }, [isConnected]);

  const badge = diagnostics
    ? routeTypeBadge(diagnostics.routeType)
    : selectedRoute
      ? routeTypeBadge(selectedRoute.routeType)
      : null;

  return (
    <View style={styles.container}>
      {(isStale || isDisconnected) && (
        <View
          style={styles.offlineBanner}
          accessibilityRole="alert"
          accessibilityLabel="Offline or disconnected. Showing last known route diagnostics when available."
        >
          <Text style={styles.offlineText}>
            {isStale ? "Offline — showing cached diagnostics" : "Disconnected — reconnect to refresh diagnostics"}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{statusLabel}</Text>
        </View>

        {badge && (
          <View style={styles.row}>
            <Text style={styles.label}>Route</Text>
            <View style={[styles.badge, { backgroundColor: badge.color }]}>
              <Text style={styles.badgeText}>{badge.label}</Text>
            </View>
          </View>
        )}

        {diagnostics && (
          <>
            <View style={styles.row}>
              <Text
                style={styles.label}
                accessibilityLabel={`Latency: ${diagnostics.latencyMs} milliseconds`}
              >
                Latency
              </Text>
              <Text style={[styles.value, { color: latencyColor(diagnostics.latencyMs) }]}>
                {diagnostics.latencyMs}ms
              </Text>
            </View>

            <View style={styles.row}>
              <Text
                style={styles.label}
                accessibilityLabel={`Uptime: ${formatUptime(diagnostics.uptimeMs)}`}
              >
                Uptime
              </Text>
              <Text style={styles.value}>{formatUptime(diagnostics.uptimeMs)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Reconnects</Text>
              <Text style={styles.value}>{diagnostics.reconnectCount}</Text>
            </View>

            {diagnostics.lastReconnectReason ? (
              <View style={styles.row}>
                <Text style={styles.label}>Last Reconnect</Text>
                <Text style={styles.value} numberOfLines={1}>
                  {diagnostics.lastReconnectReason}
                </Text>
              </View>
            ) : null}

            <View style={styles.row}>
              <Text style={styles.label}>P95 Delivery</Text>
              <Text style={styles.value}>{diagnostics.messageDeliveryP95Ms}ms</Text>
            </View>
          </>
        )}

        {!diagnostics && selectedRoute && (
          <View style={styles.row}>
            <Text style={styles.label}>Endpoint</Text>
            <Text style={styles.value} numberOfLines={1}>
              {selectedRoute.selectedEndpoint}
            </Text>
          </View>
        )}

        {!diagnostics && !selectedRoute && (
          <View style={styles.emptyView}>
            <Text style={styles.emptyText}>No route diagnostics available yet.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route Memory</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Direct Failures</Text>
          <Text style={styles.value}>{directFailures}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Private Failures</Text>
          <Text style={styles.value}>{privateFailures}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          style={[styles.testButton, !isConnected && styles.testButtonDisabled]}
          onPress={handleTestConnection}
          accessibilityLabel="Test connection to bridge"
          accessibilityRole="button"
          accessibilityState={{ disabled: !isConnected }}
          accessibilityHint={
            isConnected ? "Requests updated diagnostics from the host" : "Reconnect to enable this action"
          }
        >
          <Text style={styles.testButtonText}>
            {pingResult ?? "Test Connection"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  offlineBanner: {
    backgroundColor: "#f5a623",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineText: { color: "#fff", fontWeight: "600", fontSize: 14 },
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
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  label: { fontSize: 15, color: "#333" },
  value: { fontSize: 15, color: "#111", fontWeight: "500", maxWidth: "60%", textAlign: "right" },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  testButton: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  testButtonDisabled: { backgroundColor: "#9aa0a6" },
  testButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  emptyView: { paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15, color: "#888" },
});
