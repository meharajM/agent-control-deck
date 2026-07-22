export interface ProbeResult {
  available: boolean;
  version?: string;
  error?: string;
}

export interface StartSessionParams {
  workingDirectory?: string;
  instruction?: string;
}

export interface ReconcileResult {
  sessionExists: boolean;
  state?: string;
}

export interface AdapterEvent {
  type: string;
  sessionId: string;
  payload: unknown;
  timestamp: string;
}

export interface ConformanceAdapter {
  readonly runtimeType: 'codex' | 'opencode' | 'claude' | 'fake';
  readonly adapterVersion: string;

  probe(): Promise<ProbeResult>;
  startSession(params: StartSessionParams): Promise<string>;
  sendInstruction(sessionId: string, text: string, idempotencyKey: string): Promise<void>;
  cancelSession(sessionId: string, idempotencyKey: string): Promise<void>;
  resolveApproval(sessionId: string, approvalId: string, decision: string, idempotencyKey: string): Promise<void>;
  answerQuestion(sessionId: string, questionId: string, answer: unknown, idempotencyKey: string): Promise<void>;
  reconcile(sessionId: string): Promise<ReconcileResult>;
  dispose(): Promise<void>;
  on(event: 'session_event', listener: (event: AdapterEvent) => void): this;
  off(event: 'session_event', listener: (event: AdapterEvent) => void): this;
}