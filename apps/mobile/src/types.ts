/**
 * Shared UCP types used across mobile stores and services.
 * These are mobile-local normalizations; do not import bridge internals.
 */

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "stale";

export type SessionState =
  | "idle"
  | "queued"
  | "running"
  | "waiting_user"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted"
  | "disconnected"
  | "unknown";

export type ApprovalState =
  | "pending"
  | "answering"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired"
  | "resolved_elsewhere"
  | "failed";

export type QuestionState = "pending" | "answered" | "expired";

export interface NormalizedSession {
  id: string;
  title: string;
  state: SessionState;
  summary: string;
  currentAction: string | null;
  pendingApprovalCount: number;
  pendingQuestionCount: number;
  /** Negotiated capabilities for this session (capability-driven UI). */
  capabilities: Record<string, unknown>;
  /** Monotonic version — lower versions are ignored on update. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedApproval {
  id: string;
  sessionId: string;
  /** Exact action category from the runtime, e.g. "command" | "fileChange" | "network". */
  category: string;
  risk: string;
  reversible: string;
  title: string;
  summary: string;
  /** Runtime-provided decision labels, e.g. ["approve", "reject"]. */
  decisions: string[];
  state: ApprovalState;
  expiresAt: string | null;
  /** Monotonic version for compare-and-set. */
  version: number;
}

export interface NormalizedQuestion {
  id: string;
  sessionId: string;
  prompt: string;
  /** Null means free-text only. */
  options: string[] | null;
  state: QuestionState;
}

/** Discriminated union of all inbound UCP events the mobile store handles. */
export type UcpEvent =
  | { type: "session.created"; payload: SessionCreatedPayload }
  | { type: "session.updated"; payload: SessionUpdatedPayload }
  | { type: "session.state_changed"; payload: SessionStateChangedPayload }
  | { type: "session.completed"; payload: SessionCompletedPayload }
  | { type: "approval.requested"; payload: ApprovalRequestedPayload }
  | { type: "approval.updated"; payload: ApprovalUpdatedPayload }
  | { type: "approval.resolved"; payload: ApprovalResolvedPayload }
  | { type: "question.requested"; payload: QuestionRequestedPayload }
  | { type: "question.resolved"; payload: QuestionResolvedPayload }
  | { type: "host.snapshot"; payload: HostSnapshotPayload }
  | { type: string; payload: Record<string, unknown> };

export interface SessionCreatedPayload {
  id: string;
  title: string;
  state: SessionState;
  summary: string;
  currentAction?: string | null;
  pendingApprovalCount?: number;
  pendingQuestionCount?: number;
  capabilities?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUpdatedPayload {
  id: string;
  title?: string;
  state?: SessionState;
  summary?: string;
  currentAction?: string | null;
  pendingApprovalCount?: number;
  pendingQuestionCount?: number;
  capabilities?: Record<string, unknown>;
  version: number;
  updatedAt: string;
}

export interface SessionStateChangedPayload {
  id: string;
  state: SessionState;
  version: number;
  updatedAt: string;
}

export interface SessionCompletedPayload {
  id: string;
  summary?: string;
  version: number;
  updatedAt: string;
}

export interface ApprovalRequestedPayload {
  id: string;
  sessionId: string;
  category: string;
  risk: string;
  reversible: string;
  title: string;
  summary: string;
  decisions: string[];
  expiresAt?: string | null;
  version: number;
}

export interface ApprovalUpdatedPayload {
  id: string;
  state: ApprovalState;
  version: number;
}

export interface ApprovalResolvedPayload {
  id: string;
  state: ApprovalState;
  version: number;
}

export interface QuestionRequestedPayload {
  id: string;
  sessionId: string;
  prompt: string;
  options?: string[] | null;
}

export interface QuestionResolvedPayload {
  id: string;
  state: QuestionState;
}

export interface HostSnapshotPayload {
  hostId: string;
  sessions: SessionCreatedPayload[];
  approvals: ApprovalRequestedPayload[];
  questions: QuestionRequestedPayload[];
  sequence: number;
}
