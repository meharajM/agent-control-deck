/**
 * Adapter event emitted by a RuntimeAdapter when runtime state changes.
 * Payload is opaque to the bridge; adapters must never include credentials or
 * raw source code in the payload — apply redaction before emission.
 */
export interface AdapterEvent {
  type: string;
  sessionId: string;
  payload: unknown;
  timestamp: string; // ISO-8601
}

export interface ProbeResult {
  available: boolean;
  version?: string | undefined;
  error?: string | undefined;
}

export interface StartSessionParams {
  workingDirectory?: string | undefined;
  instruction?: string | undefined;
}

export interface ReconcileResult {
  sessionExists: boolean;
  state?: string | undefined;
}

/**
 * Shared interface that every runtime adapter must implement.
 * Adapters own the connection to their runtime; the bridge calls these methods
 * and receives normalized events via the 'session_event' EventEmitter channel.
 *
 * Invariants:
 * - probe() is called before any session operation.
 * - All idempotency keys are provided by the bridge; adapters must honour them.
 * - dispose() must be safe to call multiple times.
 */
export interface RuntimeAdapter {
  readonly runtimeType: 'codex' | 'opencode' | 'claude' | 'fake';
  readonly adapterVersion: string;

  probe(): Promise<ProbeResult>;

  /** Returns the bridge-assigned session ID (adapters may map to a runtime-native ID internally). */
  startSession(params: StartSessionParams): Promise<string>;

  sendInstruction(
    sessionId: string,
    text: string,
    idempotencyKey: string
  ): Promise<void>;

  cancelSession(sessionId: string, idempotencyKey: string): Promise<void>;

  resolveApproval(
    sessionId: string,
    approvalId: string,
    decision: string,
    idempotencyKey: string
  ): Promise<void>;

  answerQuestion(
    sessionId: string,
    questionId: string,
    answer: unknown,
    idempotencyKey: string
  ): Promise<void>;

  /**
   * Re-synchronizes adapter state after bridge or runtime restart.
   * Must not throw; return { sessionExists: false } when session is gone.
   */
  reconcile(sessionId: string): Promise<ReconcileResult>;

  dispose(): Promise<void>;

  on(event: 'session_event', listener: (event: AdapterEvent) => void): this;
  off(event: 'session_event', listener: (event: AdapterEvent) => void): this;
}
