/**
 * Event Normalizer
 * Maps OpenCode SSE events to bridge-neutral AdapterEvent types.
 * // ponytail: pure function mapping, no side effects
 */

import type { AdapterEvent } from '@agent-deck/adapter-contract';

export interface OpenCodeEvent {
  type: string;
  properties: Record<string, unknown>;
}

interface SessionStateProps {
  sessionId: string;
  status: string;
}

interface PermissionEventProps {
  id: string;
  sessionID: string;
  title: string;
  metadata: Record<string, unknown>;
  time: { created: number };
}

interface MessageEventProps {
  info: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
    timestamp: number;
  };
}

interface MessagePartEventProps {
  part: {
    id: string;
    sessionID: string;
    type: string;
    state?: { status: string };
    tool?: string;
    callID?: string;
  };
}

/**
 * Convert OpenCode event to normalized AdapterEvent.
 * Returns null for events that don't map to bridge events.
 */
export function normalizeEvent(event: OpenCodeEvent): AdapterEvent | null {
  const timestamp = new Date().toISOString();

  switch (event.type) {
    case 'session.created': {
      const props = event.properties as unknown as SessionStateProps;
      return {
        type: 'session.started',
        sessionId: props.sessionId,
        payload: { status: props.status },
        timestamp,
      };
    }

    case 'session.updated': {
      const props = event.properties as unknown as SessionStateProps;
      if (props.status === 'idle' || props.status === 'completed') {
        return {
          type: 'session.completed',
          sessionId: props.sessionId,
          payload: { status: props.status },
          timestamp,
        };
      }
      if (props.status === 'error') {
        return {
          type: 'session.failed',
          sessionId: props.sessionId,
          payload: { status: props.status },
          timestamp,
        };
      }
      return null;
    }

    case 'session.deleted': {
      const props = event.properties as unknown as { sessionId: string };
      return {
        type: 'session.completed',
        sessionId: props.sessionId,
        payload: { status: 'deleted' },
        timestamp,
      };
    }

    case 'session.error': {
      const props = event.properties as unknown as { sessionID?: string; error?: unknown };
      return {
        type: 'session.failed',
        sessionId: props.sessionID ?? '',
        payload: { error: String(props.error ?? 'Unknown error') },
        timestamp,
      };
    }

    case 'session.idle': {
      const props = event.properties as unknown as { sessionID: string };
      return {
        type: 'session.idle',
        sessionId: props.sessionID,
        payload: {},
        timestamp,
      };
    }

    case 'permission.updated': {
      const props = event.properties as unknown as PermissionEventProps;
      return {
        type: 'approval.requested',
        sessionId: props.sessionID,
        payload: {
          approvalId: props.id,
          title: props.title,
          category: 'permission',
          options: extractPermissionOptions(props.metadata),
          metadata: props.metadata,
        },
        timestamp,
      };
    }

    case 'message.part.updated': {
      const props = event.properties as unknown as MessagePartEventProps;
      const part = props.part;

      if (part.type === 'tool' && part.state?.status === 'pending') {
        return {
          type: 'instruction.pending',
          sessionId: part.sessionID,
          payload: {
            toolName: part.tool,
            callId: part.callID,
            input: part.state,
          },
          timestamp,
        };
      }

      if (part.type === 'tool' && part.state?.status === 'completed') {
        return {
          type: 'instruction.completed',
          sessionId: part.sessionID,
          payload: {
            toolName: part.tool,
            callId: part.callID,
            output: (part.state as { output?: string }).output,
          },
          timestamp,
        };
      }

      if (part.type === 'step-start') {
        return {
          type: 'session.step_started',
          sessionId: part.sessionID,
          payload: { stepId: part.id },
          timestamp,
        };
      }

      if (part.type === 'step-finish') {
        return {
          type: 'session.step_finished',
          sessionId: part.sessionID,
          payload: {
            stepId: part.id,
            cost: (part as { cost?: number }).cost,
            tokens: (part as { tokens?: unknown }).tokens,
          },
          timestamp,
        };
      }
      return null;
    }

    case 'message.updated': {
      const props = event.properties as unknown as MessageEventProps;
      const info = props.info;
      return {
        type: 'session.message',
        sessionId: info.sessionId,
        payload: {
          messageId: info.id,
          role: info.role,
          content: info.content,
        },
        timestamp,
      };
    }

    default:
      return null;
  }
}

/**
 * Extract permission decision options from OpenCode permission metadata.
 * OpenCode permissions typically have options like 'allow', 'deny', 'allow_once', etc.
 */
function extractPermissionOptions(metadata: Record<string, unknown>): string[] {
  if (Array.isArray(metadata.options)) {
    return metadata.options.map((o) => String(o));
  }
  // Fallback to standard permission decisions
  return ['allow', 'deny'];
}

/**
 * Normalize OpenCode session status to bridge session state.
 */
export function normalizeSessionStatus(status: string): 'running' | 'idle' | 'completed' | 'failed' {
  switch (status) {
    case 'running':
    case 'busy':
      return 'running';
    case 'idle':
    case 'waiting':
      return 'idle';
    case 'completed':
    case 'finished':
    case 'done':
      return 'completed';
    case 'error':
    case 'failed':
    case 'crashed':
      return 'failed';
    default:
      return 'running';
  }
}