/**
 * Event Normalizer Tests
 * Tests OpenCode event to AdapterEvent normalization.
 */

import { describe, it, expect } from 'vitest';
import { normalizeEvent, normalizeSessionStatus } from '../normalization/event-normalizer.js';

describe('normalizeEvent', () => {
  it('normalizes session.created to session.started', () => {
    const event = {
      type: 'session.created',
      properties: { sessionId: 'sess-123', status: 'running' },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'session.started',
        sessionId: 'sess-123',
        payload: { status: 'running' },
        timestamp: expect.any(String),
      })
    );
  });

  it('normalizes session.updated idle to session.completed', () => {
    const event = {
      type: 'session.updated',
      properties: { sessionId: 'sess-123', status: 'idle' },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'session.completed',
        sessionId: 'sess-123',
        payload: { status: 'idle' },
      })
    );
  });

  it('normalizes session.updated error to session.failed', () => {
    const event = {
      type: 'session.updated',
      properties: { sessionId: 'sess-123', status: 'error' },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'session.failed',
        sessionId: 'sess-123',
        payload: { status: 'error' },
      })
    );
  });

  it('normalizes session.deleted to session.completed', () => {
    const event = {
      type: 'session.deleted',
      properties: { sessionId: 'sess-123' },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'session.completed',
        sessionId: 'sess-123',
        payload: { status: 'deleted' },
      })
    );
  });

  it('normalizes session.error to session.failed', () => {
    const event = {
      type: 'session.error',
      properties: { sessionID: 'sess-123', error: 'Connection lost' },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'session.failed',
        sessionId: 'sess-123',
        payload: { error: 'Connection lost' },
      })
    );
  });

  it('normalizes session.idle', () => {
    const event = {
      type: 'session.idle',
      properties: { sessionID: 'sess-123' },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'session.idle',
        sessionId: 'sess-123',
        payload: {},
      })
    );
  });

  it('normalizes permission.updated to approval.requested', () => {
    const event = {
      type: 'permission.updated',
      properties: {
        id: 'perm-123',
        sessionID: 'sess-123',
        title: 'Run command',
        metadata: { command: 'npm test' },
        time: { created: Date.now() },
      },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'approval.requested',
        sessionId: 'sess-123',
        payload: expect.objectContaining({
          approvalId: 'perm-123',
          title: 'Run command',
          category: 'permission',
          options: expect.arrayContaining(['allow', 'deny']),
        }),
      })
    );
  });

  it('normalizes message.part.updated tool pending to instruction.pending', () => {
    const event = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part-123',
          sessionID: 'sess-123',
          type: 'tool',
          callID: 'call-456',
          tool: 'bash',
          state: { status: 'pending' },
        },
      },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'instruction.pending',
        sessionId: 'sess-123',
        payload: expect.objectContaining({
          toolName: 'bash',
          callId: 'call-456',
        }),
      })
    );
  });

  it('normalizes message.part.updated tool completed to instruction.completed', () => {
    const event = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'part-123',
          sessionID: 'sess-123',
          type: 'tool',
          callID: 'call-456',
          tool: 'bash',
          state: { status: 'completed', output: 'done' },
        },
      },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'instruction.completed',
        sessionId: 'sess-123',
        payload: expect.objectContaining({
          toolName: 'bash',
          callId: 'call-456',
          output: 'done',
        }),
      })
    );
  });

  it('normalizes message.part.updated step-start', () => {
    const event = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'step-123',
          sessionID: 'sess-123',
          type: 'step-start',
        },
      },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'session.step_started',
        sessionId: 'sess-123',
        payload: { stepId: 'step-123' },
      })
    );
  });

  it('normalizes message.part.updated step-finish', () => {
    const event = {
      type: 'message.part.updated',
      properties: {
        part: {
          id: 'step-123',
          sessionID: 'sess-123',
          type: 'step-finish',
          cost: 0.01,
          tokens: { input: 100, output: 50 },
        },
      },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'session.step_finished',
        sessionId: 'sess-123',
        payload: expect.objectContaining({
          stepId: 'step-123',
          cost: 0.01,
          tokens: { input: 100, output: 50 },
        }),
      })
    );
  });

  it('normalizes message.updated to session.message', () => {
    const event = {
      type: 'message.updated',
      properties: {
        info: {
          id: 'msg-123',
          sessionId: 'sess-123',
          role: 'assistant',
          content: 'Hello world',
          timestamp: Date.now(),
        },
      },
    };

    const result = normalizeEvent(event);

    expect(result).toEqual(
      expect.objectContaining({
        type: 'session.message',
        sessionId: 'sess-123',
        payload: expect.objectContaining({
          messageId: 'msg-123',
          role: 'assistant',
          content: 'Hello world',
        }),
      })
    );
  });

  it('returns null for unknown event types', () => {
    const event = {
      type: 'unknown.event',
      properties: {},
    };

    const result = normalizeEvent(event);
    expect(result).toBeNull();
  });
});

describe('normalizeSessionStatus', () => {
  it('maps running to running', () => {
    expect(normalizeSessionStatus('running')).toBe('running');
    expect(normalizeSessionStatus('busy')).toBe('running');
  });

  it('maps idle to idle', () => {
    expect(normalizeSessionStatus('idle')).toBe('idle');
    expect(normalizeSessionStatus('waiting')).toBe('idle');
  });

  it('maps completed to completed', () => {
    expect(normalizeSessionStatus('completed')).toBe('completed');
    expect(normalizeSessionStatus('finished')).toBe('completed');
    expect(normalizeSessionStatus('done')).toBe('completed');
  });

  it('maps error to failed', () => {
    expect(normalizeSessionStatus('error')).toBe('failed');
    expect(normalizeSessionStatus('failed')).toBe('failed');
    expect(normalizeSessionStatus('crashed')).toBe('failed');
  });

  it('defaults to running for unknown status', () => {
    expect(normalizeSessionStatus('unknown')).toBe('running');
  });
});