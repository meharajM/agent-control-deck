import { describe, it, expect } from 'vitest';
import { normalizeCodexEvent } from '../normalization/event-normalizer.js';
import type { JsonRpcNotification } from '../schema/codex-types.js';

describe('event-normalizer', () => {
  const bridgeSessionId = 'bridge-session-123';

  it('normalizes current thread/started to session.started', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'thread/started',
      params: { thread: { id: 'thread-current', cwd: '/home/user/project', status: { type: 'idle' } } },
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event).toEqual(expect.objectContaining({
      type: 'session.started',
      sessionId: bridgeSessionId,
      payload: { threadId: 'thread-current', workingDirectory: '/home/user/project' },
    }));
  });

  it('normalizes current turn/completed interruption to session.cancelled', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'turn/completed',
      params: { turn: { id: 'turn-current', status: 'interrupted', items: [] } },
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event!.type).toBe('session.cancelled');
    expect(event!.payload).toEqual({ turnId: 'turn-current', items: [] });
  });

  it('normalizes thread_created to session.started', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'notifications/thread_created',
      params: { threadId: 'thread-456', workingDirectory: '/home/user/project' },
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('session.started');
    expect(event!.sessionId).toBe(bridgeSessionId);
    expect(event!.payload).toEqual({ threadId: 'thread-456', workingDirectory: '/home/user/project' });
  });

  it('normalizes turn_started to session.working', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'notifications/turn_started',
      params: { threadId: 'thread-456' },
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event!.type).toBe('session.working');
    expect(event!.payload).toEqual({ threadId: 'thread-456' });
  });

  it('normalizes turn_completed to session.completed', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'notifications/turn_completed',
      params: { threadId: 'thread-456', turnId: 'turn-789', items: [] },
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event!.type).toBe('session.completed');
    expect(event!.payload).toEqual({ threadId: 'thread-456', turnId: 'turn-789', items: [] });
  });

  it('normalizes approval_requested to approval.requested', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'notifications/approval_requested',
      params: {
        threadId: 'thread-456',
        approvalId: 'approval-123',
        category: 'command',
        risk: 'high',
        reversible: 'no',
        title: 'Run dangerous command',
        summary: 'This command deletes files',
        decisions: ['approve', 'reject'],
        details: { command: 'rm -rf /' },
      },
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event!.type).toBe('approval.requested');
    expect(event!.payload).toEqual({
      approvalId: 'approval-123',
      category: 'command',
      risk: 'high',
      reversible: 'no',
      title: 'Run dangerous command',
      summary: 'This command deletes files',
      decisions: ['approve', 'reject'],
      details: { command: 'rm -rf /' },
    });
  });

  it('normalizes user_input_requested to question.requested', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'notifications/user_input_requested',
      params: {
        threadId: 'thread-456',
        questionId: 'question-789',
        prompt: 'Which file to edit?',
        type: 'choice',
        choices: ['file1.ts', 'file2.ts'],
      },
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event!.type).toBe('question.requested');
    expect(event!.payload).toEqual({
      questionId: 'question-789',
      prompt: 'Which file to edit?',
      type: 'choice',
      choices: ['file1.ts', 'file2.ts'],
    });
  });

  it('normalizes thread_interrupted to session.cancelled', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'notifications/thread_interrupted',
      params: { threadId: 'thread-456', reason: 'user_cancelled' },
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event!.type).toBe('session.cancelled');
    expect(event!.payload).toEqual({ reason: 'user_cancelled' });
  });

  it('normalizes thread_completed to session.completed', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'notifications/thread_completed',
      params: { threadId: 'thread-456' },
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event!.type).toBe('session.completed');
    expect(event!.payload).toEqual({ threadId: 'thread-456' });
  });

  it('normalizes thread_failed to session.failed', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'notifications/thread_failed',
      params: { threadId: 'thread-456', error: 'Connection lost' },
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event!.type).toBe('session.failed');
    expect(event!.payload).toEqual({ error: 'Connection lost' });
  });

  it('returns null for unknown notification method', () => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'notifications/unknown_method',
      params: {},
    };

    const event = normalizeCodexEvent(notification, bridgeSessionId);
    expect(event).toBeNull();
  });
});
