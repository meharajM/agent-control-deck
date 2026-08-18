import Storage from "expo-sqlite/kv-store";
import type { DeckCommandId } from "./control-deck";

const DISMISSED_SESSIONS_KEY = "control-deck.dismissed-sessions.v1";
const PINNED_COMMANDS_KEY = "control-deck.pinned-commands.v1";

const COMMAND_IDS = new Set<DeckCommandId>([
  "focus",
  "summarize",
  "explain_blocker",
  "review_diff",
  "run_tests",
  "prepare_handoff",
  "stop",
]);

function parseStringArray(value: string | null): string[] {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function loadDismissedSessionIds(): Promise<string[]> {
  return parseStringArray(await Storage.getItem(DISMISSED_SESSIONS_KEY));
}

export async function saveDismissedSessionIds(sessionIds: readonly string[]): Promise<void> {
  await Storage.setItem(DISMISSED_SESSIONS_KEY, JSON.stringify([...new Set(sessionIds)]));
}

export async function loadPinnedCommands(): Promise<DeckCommandId[]> {
  return parseStringArray(await Storage.getItem(PINNED_COMMANDS_KEY)).filter(
    (id): id is DeckCommandId => COMMAND_IDS.has(id as DeckCommandId),
  );
}

export async function savePinnedCommands(commandIds: readonly DeckCommandId[]): Promise<void> {
  await Storage.setItem(PINNED_COMMANDS_KEY, JSON.stringify([...new Set(commandIds)]));
}
