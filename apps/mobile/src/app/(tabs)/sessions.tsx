import { useRouter } from "expo-router";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSessionStore } from "../../store/session-store";
import type { NormalizedSession } from "../../types";

/** Map internal session state to a human-readable label (per product spec §7). */
function stateLabel(state: NormalizedSession["state"]): string {
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
    case "disconnected":
    case "unknown":
    default:
      return "Offline";
  }
}

interface SessionTileProps {
  session: NormalizedSession;
  onPress: () => void;
}

function SessionTile({ session, onPress }: SessionTileProps) {
  const label = stateLabel(session.state);
  const hasPending =
    session.pendingApprovalCount > 0 || session.pendingQuestionCount > 0;

  const updatedAt = new Date(session.updatedAt);
  const timeStr = updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <Pressable
      style={styles.tile}
      onPress={onPress}
      accessibilityLabel={`Session: ${session.title}. Status: ${label}. Updated ${timeStr}.${hasPending ? " Needs attention." : ""}`}
      accessibilityRole="button"
      accessibilityHint="Opens session detail"
    >
      <View style={styles.tileRow}>
        <Text style={styles.tileTitle} numberOfLines={1}>
          {session.title}
        </Text>
        {hasPending ? (
          <View
            style={styles.badge}
            accessibilityLabel={`${session.pendingApprovalCount + session.pendingQuestionCount} pending items`}
          >
            <Text style={styles.badgeText}>
              {session.pendingApprovalCount + session.pendingQuestionCount}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.tileMeta}>
        <Text
          style={styles.stateLabel}
          accessibilityRole="text"
          accessibilityState={{ busy: session.state === "running" }}
        >
          {label}
        </Text>
        <Text style={styles.timeLabel}>{timeStr}</Text>
      </View>
      {session.currentAction !== null && session.currentAction !== "" ? (
        <Text style={styles.action} numberOfLines={2}>
          {session.currentAction}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function SessionsListScreen() {
  const router = useRouter();
  const sessions = useSessionStore((s) => s.sessions);
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const sessionList = Object.values(sessions);

  return (
    <View style={styles.container}>
      {connectionStatus === "stale" || connectionStatus === "disconnected" ? (
        <View
          style={styles.staleBanner}
          accessibilityRole="alert"
          accessibilityLabel="Offline — showing cached data. State-changing controls are disabled."
        >
          <Text style={styles.staleText}>
            Offline — cached data may be stale
          </Text>
        </View>
      ) : null}

      <FlatList
        data={sessionList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          sessionList.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={
          <View accessibilityRole="text">
            <Text style={styles.emptyText}>No active sessions.</Text>
            <Text style={styles.emptySubtext}>
              Pair a host to see running agents here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SessionTile
            session={item}
            onPress={() => {
              router.push(`/sessions/${item.id}`);
            }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  staleBanner: {
    backgroundColor: "#f5a623",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  staleText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  tile: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 10,
    padding: 14,
    minHeight: 48,
  },
  tileRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tileTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  tileMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stateLabel: { fontSize: 13, color: "#555", marginTop: 4 },
  timeLabel: { fontSize: 12, color: "#999", marginTop: 4 },
  action: { fontSize: 13, color: "#333", marginTop: 4 },
  badge: {
    backgroundColor: "#e74c3c",
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#333", textAlign: "center" },
  emptySubtext: { fontSize: 14, color: "#888", marginTop: 8, textAlign: "center" },
});
