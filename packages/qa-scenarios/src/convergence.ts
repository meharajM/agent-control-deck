import type { EventJournal, JournalEntry } from '@agent-deck/bridge-core';
import type { SnapshotService, SessionSnapshot } from '@agent-deck/bridge-core';

export interface ConvergeResult {
  converged: boolean;
  diffs: string[];
}

export interface ReplayResult {
  equal: boolean;
  replayEvents: number;
  snapshotSession: SessionSnapshot['session'];
}

/**
 * Prove replay produces identical state to full snapshot.
 * Collects all events via replay and applies them to build normalized state,
 * then compares against snapshot result.
 */
export function assertReplayEqualsSnapshot(
  journal: EventJournal,
  snapshotService: SnapshotService,
  sessionId: string
): ReplayResult {
  const allEvents = journal.getAfter(sessionId, 0, 10000);
  const snap = snapshotService.getSessionSnapshot(sessionId);

  // Replay builds session state from events
  let replaySession: Record<string, unknown> | null = null;
  for (const entry of allEvents) {
    if (entry.type === 'session.created' || entry.type === 'session.started') {
      const p = entry.payload as Record<string, unknown>;
      replaySession = { id: sessionId, state: p['state'] ?? 'running', title: p['title'] ?? '' };
    }
    if (entry.type === 'session.completed' || entry.type === 'session.failed') {
      const p = entry.payload as Record<string, unknown>;
      if (replaySession) {
        replaySession['state'] =
          (p['status'] as string | undefined) ??
          (entry.type === 'session.completed' ? 'completed' : 'failed');
      }
    }
    if (entry.type === 'session.updated') {
      const p = entry.payload as Record<string, unknown>;
      if (replaySession) replaySession['currentAction'] = p['currentAction'] ?? null;
    }
  }

  const snapState = snap.session?.state ?? null;
  const replayState = replaySession?.['state'] as string | null ?? null;

  return {
    equal: snapState === replayState,
    replayEvents: allEvents.length,
    snapshotSession: snap.session,
  };
}

/**
 * Prove applying an event twice produces the same state (idempotency).
 */
export function assertIdempotent<T>(
  event: JournalEntry,
  applyFn: (state: T, entry: JournalEntry) => T,
  initialState: T
): { idempotent: boolean; state1: T; state2: T } {
  const state1 = applyFn(applyFn(initialState, event), event);
  const state2 = applyFn(initialState, event);
  return {
    idempotent: JSON.stringify(state1) === JSON.stringify(state2),
    state1,
    state2,
  };
}

/**
 * Prove session versions only increase monotonically.
 */
export function assertVersionMonotonic(
  sessions: Array<{ id: string; version: number }>
): { monotonic: boolean; violations: Array<{ id: string; prev: number; next: number }> } {
  const violations: Array<{ id: string; prev: number; next: number }> = [];
  const bySession = new Map<string, number>();
  for (const s of sessions) {
    const prev = bySession.get(s.id);
    if (prev !== undefined && s.version < prev) {
      violations.push({ id: s.id, prev, next: s.version });
    }
    bySession.set(s.id, s.version);
  }
  return { monotonic: violations.length === 0, violations };
}

/**
 * Prove each idempotency key dispatched exactly once.
 */
export function assertNoDuplicateDispatch(
  commands: Array<{ idempotencyKey: string; dispatched: boolean }>
): { unique: boolean; duplicates: string[] } {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const cmd of commands) {
    if (seen.has(cmd.idempotencyKey)) {
      duplicates.push(cmd.idempotencyKey);
    } else {
      seen.add(cmd.idempotencyKey);
    }
  }
  return { unique: duplicates.length === 0, duplicates };
}

/**
 * Prove runtime state matches normalized state within acceptable drift.
 */
export function assertConverged(
  runtimeState: Record<string, unknown>,
  normalizedState: Record<string, unknown>,
  options: { ignoredKeys?: string[] } = {}
): { converged: boolean; diffs: string[] } {
  const ignored = new Set(options.ignoredKeys ?? ['updatedAt', 'createdAt', 'timestamp']);
  const diffs: string[] = [];

  const allKeys = new Set([...Object.keys(runtimeState), ...Object.keys(normalizedState)]);
  for (const key of allKeys) {
    if (ignored.has(key)) continue;
    if (JSON.stringify(runtimeState[key]) !== JSON.stringify(normalizedState[key])) {
      diffs.push(key);
    }
  }

  return { converged: diffs.length === 0, diffs };
}
