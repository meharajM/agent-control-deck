import { useRouter } from "expo-router";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSessionStore } from "../../store/session-store.js";
import type { NormalizedApproval, NormalizedQuestion, NormalizedSession } from "../../types.js";

function urgencyLabel(item: { type: string; risk?: string; state: string }): string {
  if (item.type === "approval") {
    if (item.risk === "high") return "critical";
    if (item.risk === "medium") return "high";
    return "normal";
  }
  if (item.state === "failed" || item.state === "interrupted") return "critical";
  return "normal";
}

interface AttentionCard {
  kind: "approval" | "question" | "failure";
  id: string;
  sessionId: string;
  title: string;
  subtitle: string;
  urgency: string;
  state: string;
}

function buildAttentionCards(
  approvals: Record<string, NormalizedApproval>,
  questions: Record<string, NormalizedQuestion>,
  sessions: Record<string, NormalizedSession>
): AttentionCard[] {
  const cards: AttentionCard[] = [];

  for (const a of Object.values(approvals)) {
    if (a.state !== "pending") continue;
    cards.push({
      kind: "approval",
      id: a.id,
      sessionId: a.sessionId,
      title: a.title,
      subtitle: `Risk: ${a.risk}`,
      urgency: urgencyLabel({ type: "approval", risk: a.risk, state: a.state }),
      state: a.state,
    });
  }

  for (const q of Object.values(questions)) {
    if (q.state !== "pending") continue;
    cards.push({
      kind: "question",
      id: q.id,
      sessionId: q.sessionId,
      title: q.prompt,
      subtitle: q.options ? `Options: ${q.options.join(", ")}` : "Free text",
      urgency: "normal",
      state: q.state,
    });
  }

  for (const s of Object.values(sessions)) {
    if (s.state === "failed" || s.state === "interrupted") {
      cards.push({
        kind: "failure",
        id: s.id,
        sessionId: s.id,
        title: s.title,
        subtitle: s.currentAction ?? "Session encountered a problem",
        urgency: "critical",
        state: s.state,
      });
    }
  }

  const order = { critical: 0, high: 1, normal: 2 };
  return cards.sort(
    (a, b) => (order[a.urgency as keyof typeof order] ?? 2) - (order[b.urgency as keyof typeof order] ?? 2)
  );
}

function urgencyColor(urgency: string): string {
  switch (urgency) {
    case "critical":
      return "#c62828";
    case "high":
      return "#e65100";
    default:
      return "#1a73e8";
  }
}

function kindIcon(kind: string): string {
  switch (kind) {
    case "approval":
      return "!";
    case "question":
      return "?";
    case "failure":
      return "X";
    default:
      return "i";
  }
}

export default function AttentionScreen() {
  const router = useRouter();
  const approvals = useSessionStore((s) => s.pendingApprovals);
  const questions = useSessionStore((s) => s.pendingQuestions);
  const sessions = useSessionStore((s) => s.sessions);
  const connectionStatus = useSessionStore((s) => s.connectionStatus);

  const cards = buildAttentionCards(approvals, questions, sessions);
  const isOffline = connectionStatus === "stale" || connectionStatus === "disconnected";

  return (
    <View style={styles.container}>
      {isOffline ? (
        <View
          style={styles.staleBanner}
          accessibilityRole="alert"
          accessibilityLabel="Offline — showing cached data."
        >
          <Text style={styles.staleText}>Offline — cached data may be stale</Text>
        </View>
      ) : null}

      <FlatList
        data={cards}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={cards.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyView} accessibilityRole="text">
            <Text style={styles.emptyIcon}>All clear</Text>
            <Text style={styles.emptyText}>No pending items requiring attention.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              if (item.kind === "approval") {
                router.push(`/approvals/${item.id}`);
              } else {
                router.push(`/sessions/${item.sessionId}`);
              }
            }}
            accessibilityLabel={`${item.kind}: ${item.title}. ${item.subtitle}`}
            accessibilityRole="button"
            accessibilityHint="Opens detail"
          >
            <View style={[styles.iconCircle, { backgroundColor: urgencyColor(item.urgency) }]}>
              <Text style={styles.iconText}>{kindIcon(item.kind)}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  list: { padding: 12 },
  staleBanner: {
    backgroundColor: "#f5a623",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  staleText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    minHeight: 56,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111" },
  cardSubtitle: { fontSize: 13, color: "#555", marginTop: 2 },
  emptyContainer: { flex: 1 },
  emptyView: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: { fontSize: 17, fontWeight: "600", color: "#2e7d32", marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#888", textAlign: "center" },
});
