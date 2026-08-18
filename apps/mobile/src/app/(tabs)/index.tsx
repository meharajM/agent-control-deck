import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  cancelSession,
  focusSession,
  sendInstruction,
  startSession,
} from "../../services/command-sender";
import {
  DEFAULT_DECK_COMMANDS,
  getAvailableDeckCommands,
  resolvePinnedCommands,
  selectDeckSessions,
  sessionStateLabel,
  type DeckCommand,
  type DeckCommandId,
} from "../../services/control-deck";
import {
  loadDismissedSessionIds,
  loadPinnedCommands,
  saveDismissedSessionIds,
  savePinnedCommands,
} from "../../services/control-deck-preferences";
import { useConnectionStore } from "../../store/connection-store";
import { useSessionStore } from "../../store/session-store";
import type { NormalizedSession } from "../../types";

const DECK_REFRESH_MS = 60_000;

const STATE_THEME: Record<
  NormalizedSession["state"],
  { key: string; face: string; text: string }
> = {
  idle: { key: "#d8d5cc", face: "#f3f0e8", text: "#36342f" },
  queued: { key: "#bed5ff", face: "#e7efff", text: "#173765" },
  running: { key: "#72d8b4", face: "#c9f4e4", text: "#123d31" },
  waiting_user: { key: "#ffcb57", face: "#ffe6a7", text: "#503700" },
  waiting_approval: { key: "#ff8ca5", face: "#ffd0da", text: "#5f1425" },
  completed: { key: "#9cc7ff", face: "#dbeaff", text: "#153b68" },
  failed: { key: "#ff785f", face: "#ffd2ca", text: "#651c0f" },
  interrupted: { key: "#ff785f", face: "#ffd2ca", text: "#651c0f" },
  cancelled: { key: "#d8d5cc", face: "#f3f0e8", text: "#36342f" },
  disconnected: { key: "#c8c5bd", face: "#e8e5dd", text: "#48453e" },
  unknown: { key: "#c8c5bd", face: "#e8e5dd", text: "#48453e" },
};

function stateMark(state: NormalizedSession["state"]): string {
  switch (state) {
    case "running":
      return ">";
    case "waiting_user":
    case "waiting_approval":
      return "!";
    case "completed":
      return "OK";
    case "failed":
    case "interrupted":
      return "X";
    default:
      return "-";
  }
}

interface AgentKeyProps {
  session: NormalizedSession;
  selected: boolean;
  onPress: () => void;
}

function AgentKey({ session, selected, onPress }: AgentKeyProps) {
  const theme = STATE_THEME[session.state];
  const label = sessionStateLabel(session.state);
  const pending = session.pendingApprovalCount + session.pendingQuestionCount;

  return (
    <Pressable
      style={[
        styles.agentKeyBase,
        { backgroundColor: theme.key },
        selected && styles.agentKeySelected,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, busy: session.state === "running" }}
      accessibilityLabel={`${session.title}. ${label}.${pending > 0 ? ` ${pending} items need attention.` : ""}`}
      accessibilityHint="Shows details and focuses this agent on the computer when supported"
    >
      <View style={[styles.agentKeyFace, { backgroundColor: theme.face }]}>
        <View style={styles.agentKeyTopRow}>
          <Text style={[styles.agentMark, { color: theme.text }]}>{stateMark(session.state)}</Text>
          {pending > 0 ? (
            <View style={styles.pendingBadge} accessibilityElementsHidden>
              <Text style={styles.pendingBadgeText}>{pending}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.agentTitle, { color: theme.text }]} numberOfLines={2}>
          {session.title}
        </Text>
        <Text style={[styles.agentState, { color: theme.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export default function ControlDeckScreen() {
  const router = useRouter();
  const sessions = useSessionStore((state) => state.sessions);
  const approvals = useSessionStore((state) => state.pendingApprovals);
  const questions = useSessionStore((state) => state.pendingQuestions);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  const commandOutcomes = useSessionStore((state) => state.commandOutcomes);
  const clearCommandOutcome = useSessionStore((state) => state.clearCommandOutcome);
  const hostId = useConnectionStore((state) => state.hostId);
  const hostName = useConnectionStore((state) => state.hostName);
  const bridgeUrl = useConnectionStore((state) => state.bridgeUrl);
  const pairingStatus = useConnectionStore((state) => state.pairingStatus);

  const [nowMs, setNowMs] = useState(Date.now());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [dismissedSessionIds, setDismissedSessionIds] = useState<Set<string>>(new Set());
  const [pinnedCommandIds, setPinnedCommandIds] = useState<DeckCommandId[]>([
    ...DEFAULT_DECK_COMMANDS,
  ]);
  const [instruction, setInstruction] = useState("");
  const [startInstruction, setStartInstruction] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingCommands, setEditingCommands] = useState(false);
  const [focusCommandId, setFocusCommandId] = useState<string | null>(null);
  const [focusMessage, setFocusMessage] = useState<string | null>(null);
  const [focusFailed, setFocusFailed] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), DECK_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([loadDismissedSessionIds(), loadPinnedCommands()]).then(
      ([dismissed, pinned]) => {
        if (!active) return;
        setDismissedSessionIds(new Set(dismissed));
        if (pinned.length > 0) setPinnedCommandIds(pinned);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const deckSessions = selectDeckSessions(sessions, dismissedSessionIds, nowMs);
  const selectedSession =
    selectedSessionId === null ? undefined : sessions[selectedSessionId];

  useEffect(() => {
    if (deckSessions.length === 0) {
      setSelectedSessionId(null);
      return;
    }
    if (!deckSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(deckSessions[0]?.id ?? null);
    }
  }, [deckSessions, selectedSessionId]);

  useEffect(() => {
    if (focusCommandId === null) return;
    const outcome = commandOutcomes[focusCommandId];
    if (outcome === undefined) return;

    setFocusMessage(
      outcome.ok
        ? "Focused on the computer"
        : `Could not focus on the computer: ${outcome.error ?? "Unknown host error"}`,
    );
    setFocusFailed(!outcome.ok);
    clearCommandOutcome(focusCommandId);
    setFocusCommandId(null);
  }, [clearCommandOutcome, commandOutcomes, focusCommandId]);

  const isOffline = connectionStatus === "stale" || connectionStatus === "disconnected";
  const canAct = connectionStatus === "connected";
  const isPaired = pairingStatus === "paired" || hostId !== null || bridgeUrl !== null;
  const availableCommands = selectedSession
    ? getAvailableDeckCommands(selectedSession)
    : [];
  const pinnedCommands = resolvePinnedCommands(availableCommands, pinnedCommandIds);
  const selectedApprovals = selectedSession
    ? Object.values(approvals).filter(
        (approval) => approval.sessionId === selectedSession.id && approval.state === "pending",
      )
    : [];
  const selectedQuestions = selectedSession
    ? Object.values(questions).filter(
        (question) => question.sessionId === selectedSession.id && question.state === "pending",
      )
    : [];

  function requestFocus(session: NormalizedSession) {
    setFocusMessage(null);
    setFocusFailed(false);
    if (session.capabilities.desktopFocus !== true) {
      setFocusMessage(
        "Computer focus is unavailable. This host has not verified exact-session focus.",
      );
      setFocusFailed(true);
      return;
    }
    if (!canAct) {
      setFocusMessage("Computer focus is unavailable while the host is offline.");
      setFocusFailed(true);
      return;
    }
    try {
      setFocusMessage("Focusing on the computer...");
      setFocusCommandId(focusSession(session.id));
    } catch (error) {
      setFocusMessage(error instanceof Error ? error.message : "Computer focus failed.");
      setFocusFailed(true);
    }
  }

  function selectSession(session: NormalizedSession) {
    setSelectedSessionId(session.id);
    setActionMessage(null);
    requestFocus(session);
  }

  function dismissSelectedSession() {
    if (!selectedSession) return;
    const next = new Set(dismissedSessionIds);
    next.add(selectedSession.id);
    setDismissedSessionIds(next);
    void saveDismissedSessionIds([...next]);
  }

  function togglePinnedCommand(commandId: DeckCommandId) {
    const next = pinnedCommandIds.includes(commandId)
      ? pinnedCommandIds.filter((id) => id !== commandId)
      : [...pinnedCommandIds, commandId];
    setPinnedCommandIds(next);
    void savePinnedCommands(next);
  }

  function runCommand(command: DeckCommand) {
    if (!selectedSession || !canAct) return;
    setActionMessage(null);

    if (command.id === "focus") {
      requestFocus(selectedSession);
      return;
    }

    if (command.id === "stop") {
      Alert.alert("Stop this agent?", "The host will ask the runtime to cancel current work.", [
        { text: "Keep working", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: () => {
            try {
              cancelSession(selectedSession.id);
              setActionMessage("Stop requested");
            } catch (error) {
              setActionMessage(error instanceof Error ? error.message : "Stop failed");
            }
          },
        },
      ]);
      return;
    }

    if (command.prompt) {
      try {
        sendInstruction(selectedSession.id, command.prompt);
        setActionMessage(`${command.label} sent`);
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : `${command.label} failed`);
      }
    }
  }

  function sendTypedInstruction() {
    const text = instruction.trim();
    if (!selectedSession || !canAct || text === "") return;
    try {
      sendInstruction(selectedSession.id, text);
      setInstruction("");
      setActionMessage("Instruction sent");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Instruction failed");
    }
  }

  function startNewSession() {
    const text = startInstruction.trim();
    if (!canAct || text === "") return;
    try {
      startSession(text);
      setStartInstruction("");
      setActionMessage("Starting agent...");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Could not start agent");
    }
  }

  if (!isPaired) {
    return (
      <SafeAreaView style={styles.setupScreen} edges={["top", "bottom"]}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>AD</Text></View>
        <Text style={styles.setupEyebrow}>AGENT DECK</Text>
        <Text style={styles.setupTitle}>Your agents, within reach.</Text>
        <Text style={styles.setupCopy}>
          Pair this phone with the bridge running on your computer. No product account is required.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push("/(pairing)")}
          accessibilityRole="button"
          accessibilityLabel="Pair a computer"
        >
          <Text style={styles.primaryButtonText}>Pair a computer</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Text style={styles.eyebrow}>AGENT DECK</Text>
          <Text style={styles.hostName} numberOfLines={1}>{hostName ?? "Your computer"}</Text>
        </View>
        <View style={styles.headerActions}>
          <View
            style={[styles.connectionPill, isOffline && styles.connectionPillOffline]}
            accessibilityRole="text"
            accessibilityLabel={isOffline ? "Host offline, cached data" : "Host connected"}
          >
            <View style={[styles.connectionDot, isOffline && styles.connectionDotOffline]} />
            <Text style={styles.connectionText}>{isOffline ? "Offline" : "Connected"}</Text>
          </View>
          <Pressable
            style={styles.menuButton}
            onPress={() => setMenuOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel="Open app menu"
            accessibilityState={{ expanded: menuOpen }}
          >
            <Text style={styles.menuButtonText}>...</Text>
          </Pressable>
        </View>
      </View>

      {menuOpen ? (
        <View style={styles.overflowMenu} accessibilityRole="menu">
          {[
            ["All sessions", "/sessions"],
            ["Diagnostics", "/diagnostics"],
            ["Connection and setup", "/(pairing)"],
            ["Settings", "/(settings)"],
          ].map(([label, path]) => (
            <Pressable
              key={label}
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                router.push(path as never);
              }}
              accessibilityRole="menuitem"
            >
              <Text style={styles.menuItemText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isOffline ? (
        <View style={styles.offlineBanner} accessibilityRole="alert">
          <Text style={styles.offlineBannerText}>Cached state. Controls are locked until sync completes.</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>ACTIVE AGENTS</Text>
          <Text style={styles.sectionCount}>{deckSessions.length}</Text>
        </View>

        {deckSessions.length > 0 ? (
          <View style={styles.agentGrid}>
            {deckSessions.map((session) => (
              <AgentKey
                key={session.id}
                session={session}
                selected={session.id === selectedSessionId}
                onPress={() => selectSession(session)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No active agents</Text>
            <Text style={styles.emptyCopy}>Give the host a first instruction to start an agent.</Text>
            <View style={styles.startRow}>
              <TextInput
                style={[styles.instructionInput, !canAct && styles.controlDisabled]}
                value={startInstruction}
                onChangeText={setStartInstruction}
                onSubmitEditing={startNewSession}
                editable={canAct}
                placeholder="What should it do?"
                placeholderTextColor="#74716a"
                returnKeyType="send"
                accessibilityLabel="First instruction for a new agent"
              />
              <Pressable
                style={[styles.sendButton, (!canAct || startInstruction.trim() === "") && styles.sendButtonDisabled]}
                onPress={canAct && startInstruction.trim() !== "" ? startNewSession : undefined}
                accessibilityRole="button"
                accessibilityLabel="Start agent"
                accessibilityState={{ disabled: !canAct || startInstruction.trim() === "" }}
              >
                <Text style={styles.sendButtonText}>Start</Text>
              </Pressable>
            </View>
            <Text style={styles.dictationHint}>The host keeps runtime credentials and starts OpenCode locally.</Text>
            <Pressable
              style={styles.textButton}
              onPress={() => router.push("/sessions")}
              accessibilityRole="button"
            >
              <Text style={styles.textButtonLabel}>View session history</Text>
            </Pressable>
          </View>
        )}

        {selectedSession ? (
          <View style={styles.controlSurface}>
            <View style={styles.selectedHeader}>
              <View style={styles.selectedHeaderText}>
                <Text style={styles.selectedLabel}>SELECTED</Text>
                <Text style={styles.selectedTitle}>{selectedSession.title}</Text>
                <Text style={styles.selectedState}>{sessionStateLabel(selectedSession.state)}</Text>
              </View>
              {selectedSession.state === "completed" ? (
                <Pressable
                  style={styles.dismissButton}
                  onPress={dismissSelectedSession}
                  accessibilityRole="button"
                  accessibilityLabel={`Dismiss ${selectedSession.title}`}
                >
                  <Text style={styles.dismissButtonText}>Dismiss</Text>
                </Pressable>
              ) : null}
            </View>

            {focusMessage ? (
              <View style={styles.statusNotice} accessibilityRole="alert">
                <Text style={styles.statusNoticeText}>{focusMessage}</Text>
                {focusFailed && selectedSession.capabilities.desktopFocus === true && canAct ? (
                  <Pressable
                    style={styles.retryFocusButton}
                    onPress={() => requestFocus(selectedSession)}
                    accessibilityRole="button"
                    accessibilityLabel={`Retry computer focus for ${selectedSession.title}`}
                  >
                    <Text style={styles.retryFocusText}>Retry focus</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.currentAction}>
              {selectedSession.currentAction || selectedSession.summary || "Waiting for the next update."}
            </Text>

            {selectedApprovals.length > 0 ? (
              <Pressable
                style={styles.attentionStrip}
                onPress={() => router.push(`/approvals/${selectedApprovals[0]?.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${selectedApprovals.length} pending approvals. Review approval details.`}
              >
                <Text style={styles.attentionStripLabel}>APPROVAL NEEDED</Text>
                <Text style={styles.attentionStripTitle} numberOfLines={2}>
                  {selectedApprovals[0]?.title}
                </Text>
                <Text style={styles.attentionStripAction}>Review safely</Text>
              </Pressable>
            ) : null}

            {selectedQuestions.length > 0 ? (
              <Pressable
                style={styles.questionStrip}
                onPress={() => router.push(`/sessions/${selectedSession.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${selectedQuestions.length} pending questions. Open full details to answer.`}
              >
                <Text style={styles.questionStripLabel}>QUESTION</Text>
                <Text style={styles.questionStripTitle} numberOfLines={2}>
                  {selectedQuestions[0]?.prompt}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.commandsHeader}>
              <Text style={styles.commandsTitle}>COMMANDS</Text>
              <Pressable
                style={styles.editCommandsButton}
                onPress={() => setEditingCommands((editing) => !editing)}
                accessibilityRole="button"
                accessibilityState={{ expanded: editingCommands }}
                accessibilityLabel="Configure command buttons"
              >
                <Text style={styles.editCommandsText}>{editingCommands ? "Close" : "Configure"}</Text>
              </Pressable>
            </View>

            {editingCommands ? (
              <View style={styles.commandEditor}>
                <Text style={styles.commandEditorHelp}>
                  Pin any number of commands available for this agent.
                </Text>
                {availableCommands.map((command) => {
                  const selected = pinnedCommandIds.includes(command.id);
                  return (
                    <Pressable
                      key={command.id}
                      style={styles.commandOption}
                      onPress={() => togglePinnedCommand(command.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      <Text style={styles.commandOptionMark}>{selected ? "[x]" : "[ ]"}</Text>
                      <Text style={styles.commandOptionLabel}>{command.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.commandRow}
              accessibilityLabel="Pinned agent commands"
            >
              {pinnedCommands.map((command) => (
                <Pressable
                  key={command.id}
                  style={[
                    styles.commandKey,
                    command.destructive && styles.commandKeyDestructive,
                    !canAct && styles.controlDisabled,
                  ]}
                  onPress={canAct ? () => runCommand(command) : undefined}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canAct }}
                  accessibilityLabel={`${command.label} for ${selectedSession.title}`}
                >
                  <Text
                    style={[
                      styles.commandKeyText,
                      command.destructive && styles.commandKeyTextDestructive,
                    ]}
                  >
                    {command.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.instructionRow}>
              <TextInput
                style={[styles.instructionInput, !canAct && styles.controlDisabled]}
                value={instruction}
                onChangeText={setInstruction}
                onSubmitEditing={sendTypedInstruction}
                editable={canAct}
                placeholder="Give a short instruction"
                placeholderTextColor="#74716a"
                returnKeyType="send"
                accessibilityLabel={`Instruction for ${selectedSession.title}`}
              />
              <Pressable
                style={[
                  styles.sendButton,
                  (!canAct || instruction.trim() === "") && styles.sendButtonDisabled,
                ]}
                onPress={canAct && instruction.trim() !== "" ? sendTypedInstruction : undefined}
                accessibilityRole="button"
                accessibilityLabel="Send instruction"
                accessibilityState={{ disabled: !canAct || instruction.trim() === "" }}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </Pressable>
            </View>
            <Text style={styles.dictationHint}>Keyboard dictation works here. Review text before sending.</Text>

            {actionMessage ? (
              <Text style={styles.actionMessage} accessibilityLiveRegion="polite">{actionMessage}</Text>
            ) : null}

            <Pressable
              style={styles.fullDetailsButton}
              onPress={() => router.push(`/sessions/${selectedSession.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open full details for ${selectedSession.title}`}
            >
              <Text style={styles.fullDetailsText}>Full details</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const deckFont = Platform.select({ ios: "Avenir Next", android: "sans-serif-condensed" });

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#efede6" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  header: {
    minHeight: 82,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "#efede6",
  },
  headerBrand: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: deckFont, fontSize: 11, fontWeight: "800", letterSpacing: 2, color: "#77736a" },
  hostName: { fontFamily: deckFont, marginTop: 2, fontSize: 20, fontWeight: "700", color: "#171714", flexShrink: 1 },
  headerActions: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  connectionPill: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "#d8eee4" },
  connectionPillOffline: { backgroundColor: "#e1ddd2" },
  connectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#14845e" },
  connectionDotOffline: { backgroundColor: "#77736a" },
  connectionText: { fontFamily: deckFont, fontSize: 12, fontWeight: "700", color: "#272620" },
  menuButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#1d1d1a" },
  menuButtonText: { color: "#f7f4ec", fontSize: 20, fontWeight: "800", marginTop: -8 },
  overflowMenu: { position: "absolute", zIndex: 20, top: 70, right: 16, width: 220, padding: 8, borderRadius: 16, backgroundColor: "#1d1d1a" },
  menuItem: { minHeight: 48, justifyContent: "center", paddingHorizontal: 14, borderRadius: 10 },
  menuItemText: { fontFamily: deckFont, fontSize: 15, fontWeight: "600", color: "#f7f4ec" },
  offlineBanner: { marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: "#ffe0a0" },
  offlineBannerText: { fontFamily: deckFont, fontSize: 13, fontWeight: "700", color: "#4e3707" },
  sectionHeadingRow: { marginTop: 10, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeading: { fontFamily: deckFont, fontSize: 12, fontWeight: "800", letterSpacing: 1.6, color: "#4d4a43" },
  sectionCount: { fontFamily: deckFont, fontSize: 12, fontWeight: "800", color: "#77736a" },
  agentGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  agentKeyBase: { width: "48.5%", minHeight: 132, paddingBottom: 6, borderRadius: 18 },
  agentKeySelected: { borderWidth: 3, borderColor: "#171714", padding: 2, paddingBottom: 6 },
  agentKeyFace: { flex: 1, minHeight: 126, borderRadius: 17, padding: 14, justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(23,23,20,0.12)" },
  agentKeyTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  agentMark: { fontFamily: deckFont, fontSize: 15, fontWeight: "900" },
  pendingBadge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#1d1d1a" },
  pendingBadgeText: { color: "#f7f4ec", fontSize: 12, fontWeight: "800" },
  agentTitle: { fontFamily: deckFont, fontSize: 18, fontWeight: "800", lineHeight: 21 },
  agentState: { fontFamily: deckFont, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
  emptyState: { paddingVertical: 46, alignItems: "flex-start" },
  emptyTitle: { fontFamily: deckFont, fontSize: 24, fontWeight: "800", color: "#1d1d1a" },
  emptyCopy: { fontFamily: deckFont, marginTop: 8, maxWidth: 300, fontSize: 15, lineHeight: 21, color: "#5e5a52" },
  startRow: { width: "100%", marginTop: 16, flexDirection: "row", gap: 8 },
  textButton: { minHeight: 48, justifyContent: "center", marginTop: 8 },
  textButtonLabel: { fontFamily: deckFont, fontSize: 15, fontWeight: "800", textDecorationLine: "underline", color: "#1d1d1a" },
  controlSurface: { marginTop: 20, paddingTop: 20, borderTopWidth: 2, borderTopColor: "#1d1d1a" },
  selectedHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  selectedHeaderText: { flex: 1 },
  selectedLabel: { fontFamily: deckFont, fontSize: 11, fontWeight: "800", letterSpacing: 1.6, color: "#77736a" },
  selectedTitle: { fontFamily: deckFont, marginTop: 3, fontSize: 25, lineHeight: 29, fontWeight: "800", color: "#171714" },
  selectedState: { fontFamily: deckFont, marginTop: 4, fontSize: 13, fontWeight: "800", color: "#26745b" },
  dismissButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12 },
  dismissButtonText: { fontFamily: deckFont, fontSize: 14, fontWeight: "800", color: "#5e5a52", textDecorationLine: "underline" },
  statusNotice: { marginTop: 12, padding: 11, borderRadius: 10, backgroundColor: "#e2ded3" },
  statusNoticeText: { fontFamily: deckFont, fontSize: 13, lineHeight: 18, color: "#39372f" },
  retryFocusButton: { minHeight: 48, alignSelf: "flex-start", justifyContent: "center" },
  retryFocusText: { fontFamily: deckFont, fontSize: 14, fontWeight: "900", color: "#1d1d1a", textDecorationLine: "underline" },
  currentAction: { fontFamily: deckFont, marginTop: 14, fontSize: 16, lineHeight: 23, color: "#39372f" },
  attentionStrip: { marginTop: 16, minHeight: 96, padding: 14, borderRadius: 14, backgroundColor: "#ffd0da" },
  attentionStripLabel: { fontFamily: deckFont, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: "#6c1830" },
  attentionStripTitle: { fontFamily: deckFont, marginTop: 5, fontSize: 16, lineHeight: 21, fontWeight: "700", color: "#3f0f1d" },
  attentionStripAction: { fontFamily: deckFont, marginTop: 8, fontSize: 13, fontWeight: "900", color: "#6c1830", textDecorationLine: "underline" },
  questionStrip: { marginTop: 12, minHeight: 82, padding: 14, borderRadius: 14, backgroundColor: "#ffe6a7" },
  questionStripLabel: { fontFamily: deckFont, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, color: "#5b4000" },
  questionStripTitle: { fontFamily: deckFont, marginTop: 5, fontSize: 16, lineHeight: 21, fontWeight: "700", color: "#3e2c00" },
  commandsHeader: { marginTop: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  commandsTitle: { fontFamily: deckFont, fontSize: 12, fontWeight: "900", letterSpacing: 1.6, color: "#4d4a43" },
  editCommandsButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: 4 },
  editCommandsText: { fontFamily: deckFont, fontSize: 14, fontWeight: "800", color: "#1d1d1a", textDecorationLine: "underline" },
  commandEditor: { marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: "#dedbd2" },
  commandEditorHelp: { fontFamily: deckFont, marginBottom: 6, fontSize: 13, lineHeight: 18, color: "#565249" },
  commandOption: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  commandOptionMark: { fontFamily: deckFont, width: 28, fontSize: 14, fontWeight: "900", color: "#1d1d1a" },
  commandOptionLabel: { fontFamily: deckFont, fontSize: 15, fontWeight: "700", color: "#1d1d1a" },
  commandRow: { gap: 10, paddingBottom: 8 },
  commandKey: { minWidth: 112, minHeight: 56, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#1d1d1a" },
  commandKeyDestructive: { backgroundColor: "#ffd2ca", borderWidth: 1, borderColor: "#b83924" },
  commandKeyText: { fontFamily: deckFont, fontSize: 14, fontWeight: "800", color: "#f7f4ec" },
  commandKeyTextDestructive: { color: "#711d0f" },
  controlDisabled: { opacity: 0.45 },
  instructionRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  instructionInput: { flex: 1, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: "#a9a49a", backgroundColor: "#f8f5ed", fontFamily: deckFont, fontSize: 16, color: "#1d1d1a" },
  sendButton: { minWidth: 72, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#1d1d1a" },
  sendButtonDisabled: { opacity: 0.35 },
  sendButtonText: { fontFamily: deckFont, fontSize: 14, fontWeight: "900", color: "#f7f4ec" },
  dictationHint: { fontFamily: deckFont, marginTop: 7, fontSize: 12, lineHeight: 17, color: "#77736a" },
  actionMessage: { fontFamily: deckFont, marginTop: 10, fontSize: 13, fontWeight: "800", color: "#26745b" },
  fullDetailsButton: { minHeight: 48, marginTop: 8, alignItems: "flex-start", justifyContent: "center" },
  fullDetailsText: { fontFamily: deckFont, fontSize: 15, fontWeight: "800", color: "#1d1d1a", textDecorationLine: "underline" },
  setupScreen: { flex: 1, justifyContent: "center", alignItems: "flex-start", padding: 28, backgroundColor: "#efede6" },
  brandMark: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#1d1d1a", marginBottom: 28 },
  brandMarkText: { fontFamily: deckFont, fontSize: 20, fontWeight: "900", color: "#f7f4ec", letterSpacing: 1 },
  setupEyebrow: { fontFamily: deckFont, fontSize: 12, fontWeight: "900", color: "#77736a", letterSpacing: 2 },
  setupTitle: { fontFamily: deckFont, marginTop: 8, maxWidth: 320, fontSize: 40, lineHeight: 43, fontWeight: "800", color: "#171714" },
  setupCopy: { fontFamily: deckFont, marginTop: 16, maxWidth: 340, fontSize: 17, lineHeight: 25, color: "#555149" },
  primaryButton: { marginTop: 28, minHeight: 56, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#1d1d1a" },
  primaryButtonText: { fontFamily: deckFont, fontSize: 16, fontWeight: "900", color: "#f7f4ec" },
});
