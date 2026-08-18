/** Normalize OpenCode v2 SSE events into the bridge adapter event shape. */

import type { AdapterEvent } from '@agent-deck/adapter-contract';

export interface OpenCodeEvent {
  type: string;
  data?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export function normalizeEvent(event: OpenCodeEvent): AdapterEvent | null {
  const p = event.data ?? event.properties ?? event.payload ?? {};
  const timestamp = new Date().toISOString();
  const part = recordValue(p.part);
  const sessionId = stringValue(p.sessionID ?? p.sessionId ?? part?.sessionID ?? part?.sessionId ?? (p.info as Record<string, unknown> | undefined)?.sessionID ?? (p.info as Record<string, unknown> | undefined)?.sessionId);
  if (!sessionId) return null;

  switch (event.type) {
    case 'session.created':
      return { type: 'session.started', sessionId, payload: { status: p.status ?? 'idle' }, timestamp };
    case 'session.updated': {
      const info = recordValue(p.info);
      const status = stringValue(p.status ?? info?.status);
      if (status === 'idle' || status === 'completed') return { type: 'session.completed', sessionId, payload: { status }, timestamp };
      if (status === 'error' || status === 'failed') return { type: 'session.failed', sessionId, payload: { status }, timestamp };
      return null;
    }
    case 'session.deleted':
      return { type: 'session.completed', sessionId, payload: { status: 'deleted' }, timestamp };
    case 'session.error':
      return { type: 'session.failed', sessionId, payload: { error: errorMessage(p.error) }, timestamp };
    case 'session.idle':
      return { type: 'session.idle', sessionId, payload: {}, timestamp };
    case 'session.status':
      return normalizeStatusEvent(sessionId, p.status, timestamp);
    case 'session.next.step.started':
      return { type: 'session.working', sessionId, payload: {}, timestamp };
    case 'session.next.step.ended':
      return {
        type: 'session.completed',
        sessionId,
        payload: { status: 'completed', cost: p.cost, tokens: p.tokens },
        timestamp,
      };
    case 'permission.updated':
      return normalizeLegacyPermission(sessionId, p, timestamp);
    case 'permission.asked':
    case 'permission.v2.asked':
      return {
        type: 'approval.requested',
        sessionId,
        payload: {
          approvalId: p.id,
          title: p.title ?? p.action ?? 'Permission request',
          category: 'permission',
          options: ['once', 'always', 'reject'],
          action: p.action,
          resources: p.resources,
          metadata: p.metadata,
        },
        timestamp,
      };
    case 'permission.replied':
    case 'permission.v2.replied':
      return { type: 'approval.resolved', sessionId, payload: { approvalId: p.requestID, decision: p.reply }, timestamp };
    case 'question.asked':
    case 'question.v2.asked':
      return { type: 'question.requested', sessionId, payload: { questionId: p.id, questions: p.questions, tool: p.tool }, timestamp };
    case 'question.replied':
    case 'question.v2.replied':
      return { type: 'question.answered', sessionId, payload: { questionId: p.requestID, answers: p.answers }, timestamp };
    case 'question.rejected':
    case 'question.v2.rejected':
      return { type: 'question.answered', sessionId, payload: { questionId: p.requestID, answers: [] }, timestamp };
    case 'message.updated': {
      const info = recordValue(p.info) ?? p;
      return { type: 'session.message', sessionId, payload: { messageId: info.id, role: info.role, content: info.content }, timestamp };
    }
    case 'message.part.updated':
      return normalizePart(sessionId, recordValue(p.part), timestamp);
    case 'session.next.tool.called':
      return { type: 'instruction.pending', sessionId, payload: { toolName: p.tool, callId: p.callID, input: p.input }, timestamp };
    case 'session.next.tool.success':
      return { type: 'instruction.completed', sessionId, payload: { callId: p.callID, output: p.result ?? p.content }, timestamp };
    case 'session.next.tool.failed':
      return { type: 'instruction.failed', sessionId, payload: { callId: p.callID, error: errorMessage(p.error) }, timestamp };
    case 'session.next.text.delta':
    case 'message.part.delta':
      return { type: 'message.delta', sessionId, payload: { messageId: p.assistantMessageID ?? p.messageID, delta: p.delta }, timestamp };
    default:
      return null;
  }
}

function normalizeLegacyPermission(sessionId: string, p: Record<string, unknown>, timestamp: string): AdapterEvent {
  const metadata = recordValue(p.metadata) ?? {};
  return {
    type: 'approval.requested',
    sessionId,
    payload: { approvalId: p.id, title: p.title, category: 'permission', options: extractPermissionOptions(metadata), metadata },
    timestamp,
  };
}

function normalizePart(sessionId: string, part: Record<string, unknown> | null, timestamp: string): AdapterEvent | null {
  if (!part) return null;
  const state = recordValue(part.state);
  if (part.type === 'tool' && state?.status === 'pending') return { type: 'instruction.pending', sessionId, payload: { toolName: part.tool, callId: part.callID, input: state }, timestamp };
  if (part.type === 'tool' && state?.status === 'completed') return { type: 'instruction.completed', sessionId, payload: { toolName: part.tool, callId: part.callID, output: state.output }, timestamp };
  if (part.type === 'step-start') return { type: 'session.step_started', sessionId, payload: { stepId: part.id }, timestamp };
  if (part.type === 'step-finish') return { type: 'session.step_finished', sessionId, payload: { stepId: part.id, cost: part.cost, tokens: part.tokens }, timestamp };
  return null;
}

function normalizeStatusEvent(sessionId: string, status: unknown, timestamp: string): AdapterEvent | null {
  const statusType = typeof status === 'string' ? status : recordValue(status)?.type;
  if (statusType === 'idle') return { type: 'session.idle', sessionId, payload: { status: statusType }, timestamp };
  if (statusType === 'error' || statusType === 'failed') return { type: 'session.failed', sessionId, payload: { status: statusType }, timestamp };
  return statusType ? { type: 'session.working', sessionId, payload: { status: statusType }, timestamp } : null;
}

function extractPermissionOptions(metadata: Record<string, unknown>): string[] {
  return Array.isArray(metadata.options) ? metadata.options.map(String) : ['allow', 'deny'];
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function errorMessage(value: unknown): string {
  const error = recordValue(value);
  const data = recordValue(error?.data);
  return String(data?.message ?? error?.message ?? value ?? 'Unknown error');
}

export function normalizeSessionStatus(status: string | { type?: string } | undefined): 'running' | 'idle' | 'completed' | 'failed' {
  const statusType = typeof status === 'string' ? status : status?.type;
  switch (statusType) {
    case 'idle':
    case 'waiting': return 'idle';
    case 'completed':
    case 'finished':
    case 'done': return 'completed';
    case 'error':
    case 'failed':
    case 'crashed': return 'failed';
    default: return 'running';
  }
}
