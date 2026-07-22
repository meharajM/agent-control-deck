// TypeScript types for Codex app-server JSON-RPC protocol

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

export interface InitializeParams {
  protocolVersion: string;
  capabilities?: Record<string, unknown>;
  clientInfo?: { name: string; version: string };
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo: { name: string; version: string };
}

export interface ThreadCreatedParams {
  threadId: string;
  workingDirectory?: string;
}

export interface TurnStartedParams {
  threadId: string;
  turnId: string;
}

export interface TurnCompletedParams {
  threadId: string;
  turnId: string;
  items: TurnItem[];
}

export interface TurnItem {
  id: string;
  type: 'message' | 'tool_call' | 'tool_result' | 'reasoning' | 'approval_request' | 'user_input_request';
  content?: unknown;
}

export interface ApprovalRequestedParams {
  threadId: string;
  approvalId: string;
  category: 'command' | 'edit' | 'patch' | 'file_read' | 'file_write' | 'shell' | 'network' | 'other';
  risk: 'low' | 'medium' | 'high';
  reversible: 'yes' | 'no';
  title: string;
  summary: string;
  decisions: string[];
  details?: Record<string, unknown>;
}

export interface UserInputRequestedParams {
  threadId: string;
  questionId: string;
  prompt: string;
  type: 'text' | 'choice' | 'confirm';
  choices?: string[];
}

export interface ThreadInterruptedParams {
  threadId: string;
  reason: string;
}

export interface CodexEvent {
  method: string;
  params: unknown;
}

export interface ListThreadsParams {
  limit?: number;
  offset?: number;
}

export interface ListThreadsResult {
  threads: ThreadInfo[];
}

export interface ThreadInfo {
  threadId: string;
  workingDirectory?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'cancelled' | 'error';
  itemCount?: number;
}

export interface GetThreadParams {
  threadId: string;
}

export interface GetThreadResult {
  threadId: string;
  workingDirectory?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'cancelled' | 'error';
  items: TurnItem[];
}

export interface SendTurnParams {
  threadId: string;
  text: string;
  idempotencyKey?: string;
}

export interface ResolveApprovalParams {
  threadId: string;
  approvalId: string;
  decision: 'approved' | 'rejected';
  idempotencyKey?: string;
}

export interface AnswerQuestionParams {
  threadId: string;
  questionId: string;
  answer: unknown;
  idempotencyKey?: string;
}

export interface CancelThreadParams {
  threadId: string;
  idempotencyKey?: string;
}