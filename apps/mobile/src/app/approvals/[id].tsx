import { useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSessionStore } from "../../store/session-store.js";
import { approveApproval } from "../../services/command-sender.js";

export default function ApprovalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const approval = useSessionStore((s) =>
    id !== undefined ? s.pendingApprovals[id] : undefined
  );
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const [sending, setSending] = useState<string | null>(null);

  const canAct = connectionStatus === "connected" && sending === null;

  const isOffline = connectionStatus === "stale" || connectionStatus === "disconnected";

  if (approval === undefined) {
    return (
      <View style={styles.centered} accessibilityRole="alert">
        <Text style={styles.notFound}>Approval not found or already resolved.</Text>
      </View>
    );
  }

  const isTerminal = ["approved", "rejected", "cancelled", "expired", "resolved_elsewhere", "failed"].includes(
    approval.state
  );

  function handleDecision(decision: string) {
    if (id === undefined) return;
    setSending(decision);
    try {
      approveApproval(id, decision, approval!.version);
      Alert.alert("Sent", `Decision "${decision}" sent to host.`);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to send decision.");
    } finally {
      setSending(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isOffline ? (
        <View
          style={styles.offlineBanner}
          accessibilityRole="alert"
          accessibilityLabel="Offline — showing cached data. State-changing controls are disabled."
        >
          <Text style={styles.offlineText}>
            Offline — cached data may be stale
          </Text>
        </View>
      ) : null}

      <Text
        style={styles.title}
        accessibilityRole="header"
        accessibilityLabel={`Approval: ${approval.title}`}
      >
        {approval.title}
      </Text>

      <View style={styles.metaGrid}>
        <MetaItem label="Category" value={approval.category} />
        <MetaItem label="Risk" value={approval.risk} />
        <MetaItem label="Reversible" value={approval.reversible} />
        <MetaItem label="State" value={approval.state} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Summary</Text>
        <Text style={styles.summary}>{approval.summary}</Text>
      </View>

      {isTerminal ? (
        <View
          style={styles.resolvedBanner}
          accessibilityRole="text"
          accessibilityLabel={`This approval has been ${approval.state}.`}
        >
          <Text style={styles.resolvedText}>
            Resolved: {approval.state}
          </Text>
        </View>
      ) : (
        <View
          style={styles.decisionRow}
          accessibilityRole="none"
          accessibilityLabel="Decision buttons"
        >
          {approval.decisions.map((decision) => (
            <DecisionButton
              key={decision}
              label={decision}
              disabled={!canAct}
              onPress={() => handleDecision(decision)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

interface MetaItemProps {
  label: string;
  value: string;
}

function MetaItem({ label, value }: MetaItemProps) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text
        style={styles.metaValue}
        accessibilityLabel={`${label}: ${value}`}
        accessibilityRole="text"
      >
        {value}
      </Text>
    </View>
  );
}

interface DecisionButtonProps {
  label: string;
  disabled: boolean;
  onPress: () => void;
}

function DecisionButton({ label, disabled, onPress }: DecisionButtonProps) {
  const isPrimary = label === "approve";
  return (
    <Pressable
      style={[
        styles.decisionBtn,
        isPrimary ? styles.decisionBtnPrimary : styles.decisionBtnSecondary,
        disabled && styles.decisionBtnDisabled,
      ]}
      onPress={disabled ? undefined : onPress}
      accessibilityLabel={`${label} this request`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={disabled ? "Connect to host to enable this action" : undefined}
    >
      <Text
        style={[
          styles.decisionBtnText,
          disabled && styles.decisionBtnTextDisabled,
        ]}
      >
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFound: { fontSize: 16, color: "#888" },
  offlineBanner: {
    backgroundColor: "#f5a623",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  offlineText: { color: "#fff", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#111", marginBottom: 16 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  metaItem: { minWidth: "45%" },
  metaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: { fontSize: 14, color: "#333", marginTop: 2 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summary: { fontSize: 15, color: "#333", lineHeight: 22 },
  resolvedBanner: {
    backgroundColor: "#eaf4ea",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  resolvedText: { fontSize: 15, fontWeight: "600", color: "#2e7d32" },
  decisionRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  decisionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  decisionBtnPrimary: { backgroundColor: "#2e7d32" },
  decisionBtnSecondary: { backgroundColor: "#c62828" },
  decisionBtnDisabled: { backgroundColor: "#ccc" },
  decisionBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  decisionBtnTextDisabled: { color: "#888" },
});
