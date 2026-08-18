import type { NormalizedSession, SessionState } from "../types";

export const COMPLETED_RETENTION_MS = 60 * 60 * 1000;

export type DeckCommandId =
  | "focus"
  | "summarize"
  | "explain_blocker"
  | "review_diff"
  | "run_tests"
  | "prepare_handoff"
  | "stop";

export interface DeckCommand {
  id: DeckCommandId;
  label: string;
  prompt?: string;
  destructive?: boolean;
}

export const DEFAULT_DECK_COMMANDS: readonly DeckCommandId[] = [
  "summarize",
  "run_tests",
  "stop",
];

const COMMANDS: readonly DeckCommand[] = [
  { id: "focus", label: "Focus" },
  {
    id: "summarize",
    label: "Summarize",
    prompt: "Summarize the current work and the next meaningful step.",
  },
  {
    id: "explain_blocker",
    label: "Explain blocker",
    prompt: "Explain the current blocker and the safest available options.",
  },
  {
    id: "review_diff",
    label: "Review diff",
    prompt: "Review the current diff and summarize material risks.",
  },
  {
    id: "run_tests",
    label: "Run tests",
    prompt: "Run the relevant tests and summarize any failures.",
  },
  {
    id: "prepare_handoff",
    label: "Prepare handoff",
    prompt: "Prepare a concise handoff with changes, tests, and remaining work.",
  },
  { id: "stop", label: "Stop", destructive: true },
];

const STATE_PRIORITY: Record<SessionState, number> = {
  waiting_approval: 0,
  waiting_user: 0,
  failed: 1,
  interrupted: 1,
  running: 2,
  queued: 3,
  completed: 4,
  idle: 5,
  disconnected: 6,
  unknown: 6,
  cancelled: 7,
};

export function isSessionVisibleOnDeck(
  session: NormalizedSession,
  dismissedSessionIds: ReadonlySet<string>,
  nowMs = Date.now(),
): boolean {
  if (session.state === "completed") {
    if (dismissedSessionIds.has(session.id)) return false;
    const completedAt = Date.parse(session.updatedAt);
    return Number.isFinite(completedAt) && nowMs - completedAt < COMPLETED_RETENTION_MS;
  }

  return [
    "queued",
    "running",
    "waiting_user",
    "waiting_approval",
    "failed",
    "interrupted",
  ].includes(session.state);
}

export function selectDeckSessions(
  sessions: Record<string, NormalizedSession>,
  dismissedSessionIds: ReadonlySet<string>,
  nowMs = Date.now(),
): NormalizedSession[] {
  return Object.values(sessions)
    .filter((session) => isSessionVisibleOnDeck(session, dismissedSessionIds, nowMs))
    .sort((left, right) => {
      const priority = STATE_PRIORITY[left.state] - STATE_PRIORITY[right.state];
      if (priority !== 0) return priority;
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
}

function capability(capabilities: Record<string, unknown>, key: string): boolean {
  return capabilities[key] === true;
}

export function getAvailableDeckCommands(session: NormalizedSession): DeckCommand[] {
  const canSend = session.capabilities.send !== false;
  const previews = session.capabilities.previews;
  const canPreviewDiff =
    typeof previews === "object" &&
    previews !== null &&
    (previews as Record<string, unknown>).diff === true;

  return COMMANDS.filter((command) => {
    switch (command.id) {
      case "focus":
        return capability(session.capabilities, "desktopFocus");
      case "stop":
        return session.state === "running" && session.capabilities.cancel !== false;
      case "review_diff":
        return canSend && canPreviewDiff;
      default:
        return canSend;
    }
  });
}

export function resolvePinnedCommands(
  available: readonly DeckCommand[],
  configured: readonly DeckCommandId[],
): DeckCommand[] {
  const byId = new Map(available.map((command) => [command.id, command]));
  const selected = configured
    .map((id) => byId.get(id))
    .filter((command): command is DeckCommand => command !== undefined);

  if (selected.length > 0) return selected;

  const defaults = DEFAULT_DECK_COMMANDS
    .map((id) => byId.get(id))
    .filter((command): command is DeckCommand => command !== undefined);

  return defaults.length > 0 ? defaults : available.slice(0, 3);
}

export function sessionStateLabel(state: SessionState): string {
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
