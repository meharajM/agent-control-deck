import { useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSessionStore } from "../../store/session-store";
import { sendInstruction, cancelSession, answerQuestion } from "../../services/command-sender";
import type { NormalizedApproval, NormalizedQuestion } from "../../types";

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

interface QuestionRowProps {
  question: NormalizedQuestion;
  disabled: boolean;
}

function QuestionRow({ question, disabled }: QuestionRowProps) {
  const [answerText, setAnswerText] = useState("");

  function handleAnswer(text: string) {
    if (text.trim() === "") return;
    answerQuestion(question.id, text.trim());
    setAnswerText("");
  }

  return (
    <View
      style={styles.questionRow}
      accessibilityLabel={`Question: ${question.prompt}`}
    >
      <Text style={styles.questionPrompt}>{question.prompt}</Text>
      {question.options !== null && question.options.length > 0 ? (
        <View style={styles.questionOptions}>
          {question.options.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.optionBtn, disabled && styles.disabled]}
              onPress={disabled ? undefined : () => handleAnswer(opt)}
              accessibilityLabel={`Answer: ${opt}`}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.freeTextRow}>
          <TextInput
            style={[styles.freeTextInput, disabled && styles.freeTextInputDisabled]}
            placeholder="Type your answer..."
            placeholderTextColor="#999"
            value={answerText}
            onChangeText={setAnswerText}
            editable={!disabled}
            onSubmitEditing={() => handleAnswer(answerText)}
            returnKeyType="send"
            accessibilityLabel="Free text answer"
          />
          <Pressable
            style={[styles.sendBtn, (disabled || answerText.trim() === "") && styles.sendBtnDisabled]}
            onPress={disabled ? undefined : () => handleAnswer(answerText)}
            accessibilityLabel="Send answer"
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || answerText.trim() === "" }}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useSessionStore((s) => (id !== undefined ? s.sessions[id] : undefined));
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const allApprovals = useSessionStore((s) => s.pendingApprovals);
  const allQuestions = useSessionStore((s) => s.pendingQuestions);

  const [instructionText, setInstructionText] = useState("");
  const [sendingCancel, setSendingCancel] = useState(false);

  const isOffline = connectionStatus === "stale" || connectionStatus === "disconnected";
  const canAct = connectionStatus === "connected" && !sendingCancel;

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
  const sessionQuestions = Object.values(allQuestions).filter(
    (q) => q.sessionId === id && q.state === "pending"
  );

  const label = stateLabel(session.state);
  const isRunning = session.state === "running";

  function handleSendInstruction() {
    if (id === undefined || instructionText.trim() === "") return;
    sendInstruction(id, instructionText.trim());
    setInstructionText("");
  }

  function handleCancel() {
    if (id === undefined) return;
    Alert.alert("Stop session?", "This will cancel the current session.", [
      { text: "Keep going", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: () => {
          setSendingCancel(true);
          try {
            cancelSession(id);
            Alert.alert("Sent", "Cancel command sent to host.");
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to cancel.");
          } finally {
            setSendingCancel(false);
          }
        },
      },
    ]);
  }

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

      {sessionQuestions.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel} accessibilityRole="header">
            Pending questions ({sessionQuestions.length})
          </Text>
          {sessionQuestions.map((question) => (
            <QuestionRow key={question.id} question={question} disabled={!canAct} />
          ))}
        </View>
      ) : null}

      {isRunning ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel} accessibilityRole="header">
            Send instruction
          </Text>
          <View style={styles.steeringRow}>
            <TextInput
              style={[styles.steeringInput, !canAct && styles.steeringInputDisabled]}
              placeholder="Type instruction..."
              placeholderTextColor="#999"
              value={instructionText}
              onChangeText={setInstructionText}
              editable={canAct}
              onSubmitEditing={handleSendInstruction}
              returnKeyType="send"
              accessibilityLabel="Send instruction to agent"
            />
            <Pressable
              style={[styles.sendBtn, (!canAct || instructionText.trim() === "") && styles.sendBtnDisabled]}
              onPress={canAct ? handleSendInstruction : undefined}
              accessibilityLabel="Send instruction"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAct || instructionText.trim() === "" }}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {isRunning ? (
        <View style={styles.section}>
          <Pressable
            style={[styles.stopBtn, !canAct && styles.stopBtnDisabled]}
            onPress={canAct ? handleCancel : undefined}
            accessibilityLabel="Stop session"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAct }}
            accessibilityHint="Cancels the running session"
          >
            <Text style={[styles.stopBtnText, !canAct && styles.stopBtnTextDisabled]}>
              {sendingCancel ? "Stopping..." : "Stop Session"}
            </Text>
          </Pressable>
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
  questionRow: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    minHeight: 48,
    borderLeftWidth: 4,
    borderLeftColor: "#1a73e8",
  },
  questionPrompt: { fontSize: 15, fontWeight: "600", color: "#111" },
  questionOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  optionBtn: {
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  optionText: { color: "#1a73e8", fontWeight: "600", fontSize: 14 },
  freeTextRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  freeTextInput: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  freeTextInputDisabled: { backgroundColor: "#e0e0e0", color: "#999" },
  sendBtn: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#ccc" },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  steeringRow: { flexDirection: "row", gap: 8 },
  steeringInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  steeringInputDisabled: { backgroundColor: "#f0f0f0", color: "#999" },
  stopBtn: {
    backgroundColor: "#c62828",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  stopBtnDisabled: { backgroundColor: "#ccc" },
  stopBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  stopBtnTextDisabled: { color: "#888" },
});
