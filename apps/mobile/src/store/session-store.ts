import { create } from "zustand";
import type {
  ApprovalResolvedPayload,
  ApprovalRequestedPayload,
  ApprovalUpdatedPayload,
  ConnectionStatus,
  NormalizedApproval,
  NormalizedQuestion,
  NormalizedSession,
  QuestionResolvedPayload,
  QuestionRequestedPayload,
  SessionCompletedPayload,
  SessionCreatedPayload,
  SessionStateChangedPayload,
  SessionUpdatedPayload,
  UcpEvent,
} from "../types.js";

export interface SessionState {
  connectionStatus: ConnectionStatus;
  hostId: string | null;
  sessions: Record<string, NormalizedSession>;
  pendingApprovals: Record<string, NormalizedApproval>;
  pendingQuestions: Record<string, NormalizedQuestion>;
  /** Last acknowledged event sequence for reconnect replay. */
  lastSyncSequence: number;

  // --- actions ---
  applyEvent(event: UcpEvent): void;
  setConnectionStatus(status: ConnectionStatus): void;
  markStale(): void;
  reset(): void;
}

// ---------------------------------------------------------------------------
// Handlers — pure reducers over partial state slices
// ---------------------------------------------------------------------------

function handleSessionCreated(
  sessions: Record<string, NormalizedSession>,
  p: SessionCreatedPayload
): Record<string, NormalizedSession> {
  const existing = sessions[p.id];
  // Idempotent: ignore if version is not newer
  if (existing !== undefined && existing.version >= p.version) return sessions;
  return {
    ...sessions,
    [p.id]: {
      id: p.id,
      title: p.title,
      state: p.state,
      summary: p.summary,
      currentAction: p.currentAction ?? null,
      pendingApprovalCount: p.pendingApprovalCount ?? 0,
      pendingQuestionCount: p.pendingQuestionCount ?? 0,
      capabilities: p.capabilities ?? {},
      version: p.version,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    },
  };
}

function handleSessionUpdated(
  sessions: Record<string, NormalizedSession>,
  p: SessionUpdatedPayload
): Record<string, NormalizedSession> {
  const existing = sessions[p.id];
  if (existing === undefined) return sessions;
  // Ignore stale updates
  if (existing.version >= p.version) return sessions;
  return {
    ...sessions,
    [p.id]: {
      ...existing,
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.state !== undefined ? { state: p.state } : {}),
      ...(p.summary !== undefined ? { summary: p.summary } : {}),
      ...(p.currentAction !== undefined ? { currentAction: p.currentAction } : {}),
      ...(p.pendingApprovalCount !== undefined
        ? { pendingApprovalCount: p.pendingApprovalCount }
        : {}),
      ...(p.pendingQuestionCount !== undefined
        ? { pendingQuestionCount: p.pendingQuestionCount }
        : {}),
      ...(p.capabilities !== undefined ? { capabilities: p.capabilities } : {}),
      version: p.version,
      updatedAt: p.updatedAt,
    },
  };
}

function handleSessionStateChanged(
  sessions: Record<string, NormalizedSession>,
  p: SessionStateChangedPayload
): Record<string, NormalizedSession> {
  const existing = sessions[p.id];
  if (existing === undefined) return sessions;
  if (existing.version >= p.version) return sessions;
  return {
    ...sessions,
    [p.id]: { ...existing, state: p.state, version: p.version, updatedAt: p.updatedAt },
  };
}

function handleSessionCompleted(
  sessions: Record<string, NormalizedSession>,
  p: SessionCompletedPayload
): Record<string, NormalizedSession> {
  const existing = sessions[p.id];
  if (existing === undefined) return sessions;
  if (existing.version >= p.version) return sessions;
  return {
    ...sessions,
    [p.id]: {
      ...existing,
      state: "completed",
      ...(p.summary !== undefined ? { summary: p.summary } : {}),
      version: p.version,
      updatedAt: p.updatedAt,
    },
  };
}

function handleApprovalRequested(
  approvals: Record<string, NormalizedApproval>,
  p: ApprovalRequestedPayload
): Record<string, NormalizedApproval> {
  // Idempotent: skip if already tracked at same or newer version
  const existing = approvals[p.id];
  if (existing !== undefined && existing.version >= p.version) return approvals;
  return {
    ...approvals,
    [p.id]: {
      id: p.id,
      sessionId: p.sessionId,
      category: p.category,
      risk: p.risk,
      reversible: p.reversible,
      title: p.title,
      summary: p.summary,
      decisions: p.decisions,
      state: "pending",
      expiresAt: p.expiresAt ?? null,
      version: p.version,
    },
  };
}

function handleApprovalUpdated(
  approvals: Record<string, NormalizedApproval>,
  p: ApprovalUpdatedPayload
): Record<string, NormalizedApproval> {
  const existing = approvals[p.id];
  if (existing === undefined) return approvals;
  if (existing.version >= p.version) return approvals;
  return { ...approvals, [p.id]: { ...existing, state: p.state, version: p.version } };
}

function handleApprovalResolved(
  approvals: Record<string, NormalizedApproval>,
  p: ApprovalResolvedPayload
): Record<string, NormalizedApproval> {
  const existing = approvals[p.id];
  if (existing === undefined) return approvals;
  if (existing.version >= p.version) return approvals;
  // Keep the record for UI — the card stays until the next snapshot clears it.
  // The UI renders the terminal state and disables action buttons.
  return { ...approvals, [p.id]: { ...existing, state: p.state, version: p.version } };
}

function handleQuestionRequested(
  questions: Record<string, NormalizedQuestion>,
  p: QuestionRequestedPayload
): Record<string, NormalizedQuestion> {
  if (questions[p.id] !== undefined) return questions; // idempotent
  return {
    ...questions,
    [p.id]: {
      id: p.id,
      sessionId: p.sessionId,
      prompt: p.prompt,
      options: p.options ?? null,
      state: "pending",
    },
  };
}

function handleQuestionResolved(
  questions: Record<string, NormalizedQuestion>,
  p: QuestionResolvedPayload
): Record<string, NormalizedQuestion> {
  const existing = questions[p.id];
  if (existing === undefined) return questions;
  return { ...questions, [p.id]: { ...existing, state: p.state } };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState = {
  connectionStatus: "disconnected" as ConnectionStatus,
  hostId: null,
  sessions: {} as Record<string, NormalizedSession>,
  pendingApprovals: {} as Record<string, NormalizedApproval>,
  pendingQuestions: {} as Record<string, NormalizedQuestion>,
  lastSyncSequence: 0,
};

export const useSessionStore = create<SessionState>()((set) => ({
  ...initialState,

  applyEvent(event: UcpEvent) {
    set((state) => {
      switch (event.type) {
        case "session.created":
          return { sessions: handleSessionCreated(state.sessions, event.payload) };

        case "session.updated":
          return { sessions: handleSessionUpdated(state.sessions, event.payload) };

        case "session.state_changed":
          return { sessions: handleSessionStateChanged(state.sessions, event.payload) };

        case "session.completed":
          return { sessions: handleSessionCompleted(state.sessions, event.payload) };

        case "approval.requested":
          return {
            pendingApprovals: handleApprovalRequested(
              state.pendingApprovals,
              event.payload
            ),
          };

        case "approval.updated":
          return {
            pendingApprovals: handleApprovalUpdated(
              state.pendingApprovals,
              event.payload
            ),
          };

        case "approval.resolved":
          return {
            pendingApprovals: handleApprovalResolved(
              state.pendingApprovals,
              event.payload
            ),
          };

        case "question.requested":
          return {
            pendingQuestions: handleQuestionRequested(
              state.pendingQuestions,
              event.payload
            ),
          };

        case "question.resolved":
          return {
            pendingQuestions: handleQuestionResolved(
              state.pendingQuestions,
              event.payload
            ),
          };

        case "host.snapshot": {
          const snap = event.payload;
          let sessions = {} as Record<string, NormalizedSession>;
          let pendingApprovals = {} as Record<string, NormalizedApproval>;
          let pendingQuestions = {} as Record<string, NormalizedQuestion>;
          for (const s of snap.sessions) {
            sessions = handleSessionCreated(sessions, s);
          }
          for (const a of snap.approvals) {
            pendingApprovals = handleApprovalRequested(pendingApprovals, a);
          }
          for (const q of snap.questions) {
            pendingQuestions = handleQuestionRequested(pendingQuestions, q);
          }
          return {
            sessions,
            pendingApprovals,
            pendingQuestions,
            lastSyncSequence: snap.sequence,
          };
        }

        default:
          // Unknown event types are ignored per UCP §17
          return {};
      }
    });
  },

  setConnectionStatus(status: ConnectionStatus) {
    set({ connectionStatus: status });
  },

  markStale() {
    set({ connectionStatus: "stale" });
  },

  reset() {
    set(initialState);
  },
}));
