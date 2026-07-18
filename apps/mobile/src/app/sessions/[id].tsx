import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSessionStore } from "../../store/session-store.js";
import type { NormalizedApproval } from "../../types.js";

function stateLabel(state: string): string {
  switch (state) {
    case "idle":
    case "queued":
      return "Ready";
    case "running":
      return "Working";
    case "waiting_user":
    case "waiting_approval":
      return "Needs you";
    case "completed":
      return "Done";
    case "failed":
    case "interrupted":
      return "Problem";
    default:
      return "Offline";
  }
}

interface ApprovalRowProps {
  approval: NormalizedApproval;
  disabled: boolean;
  onPress: () => void;
}

function ApprovalRow({ approval, disabled, onPress }: ApprovalRowProps) {
  return (
    <Pressable
      style={[styles.approvalRow, disabled && styles.disabled]}
      onPress={disabled ? undefined : onPress}
      accessibilityLabel={`Approval: ${approval.title}. Risk: ${approval.risk}.`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={disabled ? "Unavailable while offline" : "Opens approval detail"}
    >
      <Text style={styles.approvalTitle}>{approval.title}</Text>
      <Text style={styles.approvalMeta}>
        Risk: {approval.risk} · {approval.reversible}
      </Text>
    </Pressable>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useSessionStore((s) => (id !== undefined ? s.sessions[id] : undefined));
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const allApprovals = useSessionStore((s) => s.pendingApprovals);

  const isOffline =
    connectionStatus === "stale" || connectionStatus === "disconnected";

  if (session === undefined) {
    return (
      <View style={styles.centered} accessibilityRole="alert">
        <Text style={styles.notFound}>Session not found.</Text>
      </View>
    );
  }

  const sessionApprovals = Object.values(allApprovals).filter(
    (a) => a.sessionId === id && a.state === "pending"
  );

  const label = stateLabel(session.state);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isOffline ? (
        <View
          style={styles.staleBanner}
          accessibilityRole="alert"
          accessibilityLabel="Offline — showing cached data. State-changing controls are disabled."
        >
          <Text style={styles.staleText}>Offline — cached data may be stale</Text>
        </View>
      ) : null}

      <Text
        style={styles.title}
        accessibilityRole="header"
        accessibilityLabel={`Session: ${session.title}`}
      >
        {session.title}
      </Text>

      <View style={styles.metaRow}>
        <Text
          style={styles.stateChip}
          accessibilityRole="text"
          accessibilityLabel={`Status: ${label}`}
          accessibilityState={{ busy: session.state === "running" }}
        >
          {label}
        </Text>
      </View>

      {session.currentAction !== null && session.currentAction !== "" ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Current action</Text>
          <Text style={styles.currentAction}>{session.currentAction}</Text>
        </View>
      ) : null}

      {session.summary !== "" ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Summary</Text>
          <Text style={styles.summary}>{session.summary}</Text>
        </View>
      ) : null}

      {sessionApprovals.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel} accessibilityRole="header">
            Pending approvals ({sessionApprovals.length})
          </Text>
          {sessionApprovals.map((approval) => (
            <ApprovalRow
              key={approval.id}
              approval={approval}
              disabled={isOffline}
              onPress={() => router.push(`/approvals/${approval.id}`)}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFound: { fontSize: 16, color: "#888" },
  staleBanner: {
    backgroundColor: "#f5a623",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  staleText: { color: "#fff", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#111", marginBottom: 8 },
  metaRow: { flexDirection: "row", marginBottom: 16 },
  stateChip: {
    backgroundColor: "#e8e8e8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  currentAction: { fontSize: 15, color: "#333" },
  summary: { fontSize: 14, color: "#555", lineHeight: 20 },
  approvalRow: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    minHeight: 48,
    borderLeftWidth: 4,
    borderLeftColor: "#e74c3c",
  },
  approvalTitle: { fontSize: 15, fontWeight: "600", color: "#111" },
  approvalMeta: { fontSize: 13, color: "#555", marginTop: 4 },
  disabled: { opacity: 0.5 },
});
