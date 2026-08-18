import type { AdapterEvent } from '@agent-deck/adapter-contract';
import type { JsonRpcNotification } from '../schema/codex-types.js';

export function normalizeCodexEvent(
  notification: JsonRpcNotification,
  bridgeSessionId: string
): AdapterEvent | null {
  const { method, params } = notification;
  const timestamp = new Date().toISOString();

  switch (method) {
    case 'thread/started': {
      const p = params as { thread?: { id?: string; cwd?: string; status?: unknown } };
      return {
        type: 'session.started',
        sessionId: bridgeSessionId,
        payload: {
          threadId: p.thread?.id,
          workingDirectory: p.thread?.cwd,
        },
        timestamp,
      };
    }
    case 'turn/started': {
      const p = params as { threadId?: string; turn?: { id?: string } };
      return {
        type: 'session.working',
        sessionId: bridgeSessionId,
        payload: { threadId: p.threadId, turnId: p.turn?.id },
        timestamp,
      };
    }
    case 'turn/completed': {
      const p = params as { turn?: { id?: string; status?: string; items?: unknown[] } };
      const status = p.turn?.status;
      return {
        type: status === 'interrupted' ? 'session.cancelled' : status === 'failed' ? 'session.failed' : 'session.completed',
        sessionId: bridgeSessionId,
        payload: { turnId: p.turn?.id, items: p.turn?.items },
        timestamp,
      };
    }
    case 'thread/status/changed': {
      const p = params as { status?: { type?: string } };
      if (p.status?.type === 'active') {
        return {
          type: 'session.working',
          sessionId: bridgeSessionId,
          payload: { status: p.status.type },
          timestamp,
        };
      }
      return null;
    }
    case 'notifications/thread_created': {
      const p = params as { threadId: string; workingDirectory?: string };
      return {
        type: 'session.started',
        sessionId: bridgeSessionId,
        payload: { threadId: p.threadId, workingDirectory: p.workingDirectory },
        timestamp,
      };
    }
    case 'notifications/turn_started': {
      return {
        type: 'session.working',
        sessionId: bridgeSessionId,
        payload: { threadId: (params as { threadId: string }).threadId },
        timestamp,
      };
    }
    case 'notifications/turn_completed': {
      const p = params as { threadId: string; turnId: string; items: unknown[] };
      return {
        type: 'session.completed',
        sessionId: bridgeSessionId,
        payload: { threadId: p.threadId, turnId: p.turnId, items: p.items },
        timestamp,
      };
    }
    case 'notifications/approval_requested': {
      const p = params as {
        threadId: string;
        approvalId: string;
        category: string;
        risk: string;
        reversible: string;
        title: string;
        summary: string;
        decisions: string[];
        details?: Record<string, unknown>;
      };
      return {
        type: 'approval.requested',
        sessionId: bridgeSessionId,
        payload: {
          approvalId: p.approvalId,
          category: p.category,
          risk: p.risk,
          reversible: p.reversible,
          title: p.title,
          summary: p.summary,
          decisions: p.decisions,
          details: p.details,
        },
        timestamp,
      };
    }
    case 'notifications/user_input_requested': {
      const p = params as {
        threadId: string;
        questionId: string;
        prompt: string;
        type: string;
        choices?: string[];
      };
      return {
        type: 'question.requested',
        sessionId: bridgeSessionId,
        payload: {
          questionId: p.questionId,
          prompt: p.prompt,
          type: p.type,
          choices: p.choices,
        },
        timestamp,
      };
    }
    case 'notifications/thread_interrupted':
    case 'notifications/thread_cancelled': {
      return {
        type: 'session.cancelled',
        sessionId: bridgeSessionId,
        payload: { reason: (params as { reason: string }).reason },
        timestamp,
      };
    }
    case 'notifications/thread_completed': {
      return {
        type: 'session.completed',
        sessionId: bridgeSessionId,
        payload: { threadId: (params as { threadId: string }).threadId },
        timestamp,
      };
    }
    case 'notifications/thread_failed': {
      return {
        type: 'session.failed',
        sessionId: bridgeSessionId,
        payload: { error: (params as { error: string }).error },
        timestamp,
      };
    }
    default:
      return null;
  }
}
