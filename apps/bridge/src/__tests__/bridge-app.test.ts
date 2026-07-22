import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { BridgeApp } from '../bridge-app.js';
import { parseBridgeRuntime } from '../runtime-selection.js';
import type {
  RuntimeAdapter,
  AdapterEvent,
  ProbeResult,
  StartSessionParams,
  ReconcileResult,
} from '@agent-deck/adapter-contract';
import type { UcpEnvelope } from '@agent-deck/protocol';

function createLegacyBridgeApp(): BridgeApp {
  return new BridgeApp({ port: 0, dbPath: ':memory:', allowInsecureLegacyMode: true });
}

function waitForMessage(ws: WebSocket, type: string, timeout = 3000): Promise<UcpEnvelope> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeout);
    const handler = (data: WebSocket.Data) => {
      const msg = JSON.parse(String(data)) as UcpEnvelope;
      if (msg.type === type) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

function waitForAnyMessage(ws: WebSocket, types: string[], timeout = 3000): Promise<UcpEnvelope> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for any of ${types.join(',')}`)), timeout);
    const handler = (data: WebSocket.Data) => {
      const msg = JSON.parse(String(data)) as UcpEnvelope;
      if (types.includes(msg.type)) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

class TrackingAdapter extends EventEmitter implements RuntimeAdapter {
  readonly runtimeType = 'opencode' as const;
  readonly adapterVersion = 'test';
  readonly sendInstruction = vi.fn(async () => undefined);
  readonly cancelSession = vi.fn(async () => undefined);
  readonly resolveApproval = vi.fn(async () => undefined);
  readonly answerQuestion = vi.fn(async () => undefined);
  readonly reconcile = vi.fn(async (): Promise<ReconcileResult> => ({ sessionExists: true, state: 'running' }));

  async probe(): Promise<ProbeResult> {
    return { available: true, version: 'test' };
  }

  async startSession(_params: StartSessionParams): Promise<string> {
    const sessionId = `session-${randomUUID()}`;
    const event: AdapterEvent = {
      type: 'session.started',
      sessionId,
      payload: { status: 'running' },
      timestamp: new Date().toISOString(),
    };
    this.emit('session_event', event);
    return sessionId;
  }

  async dispose(): Promise<void> {
    this.removeAllListeners();
  }
}

describe('BridgeApp', () => {
  let app: BridgeApp;

  afterEach(() => {
    app?.stop();
  });

  it('starts, connects client, and receives initialized response', async () => {
    app = createLegacyBridgeApp();
    await app.start();

    const port = app.getGateway()!.port;
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((r) => ws.on('open', r));

    const initPromise = waitForMessage(ws, 'connection.initialized');
    ws.send(JSON.stringify({ type: 'connection.initialize' }));
    const response = await initPromise;

    expect(response.protocol).toBe('ucp');
    expect(response.hostId).toBe(app.hostId);
    ws.close();
  });

  it('session events arrive as UCP envelopes', async () => {
    app = createLegacyBridgeApp();
    await app.start();

    const port = app.getGateway()!.port;
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((r) => ws.on('open', r));

    const initPromise = waitForMessage(ws, 'connection.initialized');
    ws.send(JSON.stringify({ type: 'connection.initialize' }));
    await initPromise;

    // Start a fake session — events should flow through as UCP envelopes
    const adapter = app.getAdapterManager()!.getAdapter('fake')!;
    const eventPromise = waitForAnyMessage(ws, [
      'session.started',
      'approval.requested',
      'session.completed',
    ]);
    const sessionId = await adapter.startSession({});

    // The fake adapter fires session.started, approval.requested, session.completed
    const event = await eventPromise;

    expect(event.protocol).toBe('ucp');
    expect(event.sessionId).toBe(sessionId);
    ws.close();
  });

  it('approval arrives and can be approved via command', async () => {
    app = createLegacyBridgeApp();
    await app.start();

    const port = app.getGateway()!.port;
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((r) => ws.on('open', r));

    const initPromise = waitForMessage(ws, 'connection.initialized');
    ws.send(JSON.stringify({ type: 'connection.initialize' }));
    await initPromise;

    const adapter = app.getAdapterManager()!.getAdapter('fake')!;
    const approvalPromise = waitForMessage(ws, 'approval.requested');
    const sessionId = await adapter.startSession({});

    // Wait for approval.requested
    const approvalEvent = await approvalPromise;
    expect(approvalEvent.sessionId).toBe(sessionId);

    // Send approve command
    const approvalPayload = approvalEvent.payload as Record<string, unknown>;
    const correlationId = 'corr-approve-001';
    const ackPromise = waitForMessage(ws, 'command.ack');
    ws.send(JSON.stringify({
      protocol: 'ucp',
      version: 1,
      messageId: 'test-approve-msg',
      type: 'command/approve',
      timestamp: new Date().toISOString(),
      hostId: app.hostId,
      sessionId,
      correlationId,
      payload: {
        commandId: 'cmd-approve-001',
        idempotencyKey: 'idem-approve-001',
        approvalId: approvalPayload.approvalId,
        decision: 'approved',
      },
    }));

    const ack = await ackPromise;
    expect(ack.correlationId).toBe(correlationId);
    ws.close();
  });

  it('disconnect and reconnect works', async () => {
    app = createLegacyBridgeApp();
    await app.start();

    const port = app.getGateway()!.port;

    // First connection
    const ws1 = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((r) => ws1.on('open', r));
    const init1 = waitForMessage(ws1, 'connection.initialized');
    ws1.send(JSON.stringify({ type: 'connection.initialize' }));
    await init1;
    ws1.close();
    await new Promise((r) => setTimeout(r, 100));

    // Second connection
    const ws2 = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((r) => ws2.on('open', r));
    const init2 = waitForMessage(ws2, 'connection.initialized');
    ws2.send(JSON.stringify({ type: 'connection.initialize' }));
    const response = await init2;
    expect(response.hostId).toBe(app.hostId);
    ws2.close();
  });

  it('uses the selected runtime for command/start and follow-up session commands', async () => {
    const adapter = new TrackingAdapter();
    app = new BridgeApp({
      port: 0,
      dbPath: ':memory:',
      runtime: 'opencode',
      allowInsecureLegacyMode: true,
      createAdapter: () => adapter,
    });
    await app.start();

    expect(app.runtime).toBe('opencode');
    expect(app.getAdapterManager()!.getSelectedAdapter()).toBe(adapter);

    const port = app.getGateway()!.port;
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((r) => ws.on('open', r));

    const initPromise = waitForMessage(ws, 'connection.initialized');
    ws.send(JSON.stringify({ type: 'connection.initialize' }));
    await initPromise;

    const startAckPromise = waitForMessage(ws, 'command.ack');
    ws.send(JSON.stringify({
      protocol: 'ucp',
      version: 1,
      messageId: 'test-start-msg',
      type: 'command/start',
      timestamp: new Date().toISOString(),
      hostId: app.hostId,
      correlationId: 'corr-start',
      payload: {
        idempotencyKey: 'idem-start-1',
        instruction: 'Start selected runtime',
      },
    }));

    const startAck = await startAckPromise;
    const startedSessionId = String((startAck.payload as Record<string, unknown>).sessionId);
    expect(startedSessionId).toMatch(/^session-/);
    expect(app.getAdapterManager()!.getAdapterForSession(startedSessionId)).toBe(adapter);

    const sendAckPromise = waitForMessage(ws, 'command.ack');
    ws.send(JSON.stringify({
      protocol: 'ucp',
      version: 1,
      messageId: 'test-send-msg',
      type: 'command/send',
      timestamp: new Date().toISOString(),
      hostId: app.hostId,
      sessionId: startedSessionId,
      correlationId: 'corr-send',
      payload: {
        idempotencyKey: 'idem-send-1',
        text: 'Follow-up instruction',
      },
    }));

    const sendAck = await sendAckPromise;
    expect(sendAck.correlationId).toBe('corr-send');
    expect(adapter.sendInstruction).toHaveBeenCalledWith(
      startedSessionId,
      'Follow-up instruction',
      'idem-send-1',
    );

    ws.close();
  });
});

describe('parseBridgeRuntime', () => {
  it('accepts supported runtime selectors', () => {
    expect(parseBridgeRuntime(undefined)).toBe('fake');
    expect(parseBridgeRuntime('fake')).toBe('fake');
    expect(parseBridgeRuntime('codex')).toBe('codex');
    expect(parseBridgeRuntime('opencode')).toBe('opencode');
  });

  it('rejects unsupported runtime selectors', () => {
    expect(() => parseBridgeRuntime('claude')).toThrow(
      'Unsupported BRIDGE_RUNTIME "claude". Expected one of: fake, codex, opencode',
    );
  });
});
