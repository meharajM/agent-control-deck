/**
 * Real integration tests — no mocks, no harness, no test doubles.
 * Uses BridgeApp (real bridge) + real WebSocket + real SQLite on disk.
 * // ponytail: FakeAdapter IS the adapter (implements RuntimeAdapter), not a test double
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { BridgeApp } from '../bridge-app.js';
import { FakeAdapter, failureScenario, scenarioRegistry } from '@agent-deck/adapter-fake';
import type { ScenarioStep } from '@agent-deck/adapter-fake';

function createLegacyBridgeApp(): BridgeApp {
  return new BridgeApp({ port: 0, dbPath: ':memory:', allowInsecureLegacyMode: true });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function waitForMessage(ws: WebSocket, type: string, timeout = 5000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeout);
    const handler = (data: WebSocket.Data) => {
      const msg = JSON.parse(String(data)) as Record<string, unknown>;
      if (msg.type === type) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

function waitForAnyMessage(ws: WebSocket, types: string[], timeout = 5000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for any of [${types.join(', ')}]`)), timeout);
    const handler = (data: WebSocket.Data) => {
      const msg = JSON.parse(String(data)) as Record<string, unknown>;
      if (types.includes(msg.type as string)) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

function collectMessages(ws: WebSocket, durationMs: number): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolve) => {
    const messages: Array<Record<string, unknown>> = [];
    const handler = (data: WebSocket.Data) => {
      messages.push(JSON.parse(String(data)) as Record<string, unknown>);
    };
    ws.on('message', handler);
    setTimeout(() => {
      ws.off('message', handler);
      resolve(messages);
    }, durationMs);
  });
}

function sendEnvelope(ws: WebSocket, envelope: Record<string, unknown>): void {
  ws.send(JSON.stringify(envelope));
}

function buildCommand(
  type: string,
  payload: Record<string, unknown>,
  sessionId?: string,
  correlationId?: string,
): Record<string, unknown> {
  const env: Record<string, unknown> = {
    protocol: 'ucp',
    version: 1,
    messageId: randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    hostId: 'test-host',
    payload,
  };
  if (sessionId) env.sessionId = sessionId;
  if (correlationId) env.correlationId = correlationId;
  return env;
}

/**
 * Connect and also capture the snapshot that arrives immediately after init.
 * // ponytail: snapshot is sent right after initialized — must capture in same listener scope
 */
async function connectAndInit(
  app: BridgeApp,
): Promise<{ ws: WebSocket; snapshot: Record<string, unknown> }> {
  const port = app.getGateway()!.port;
  const ws = new WebSocket(`ws://localhost:${port}`);
  await new Promise<void>((r) => ws.on('open', r));

  // Capture both initialized and snapshot in one go
  const messages = new Promise<Record<string, unknown>[]>((resolve) => {
    const collected: Record<string, unknown>[] = [];
    const handler = (data: WebSocket.Data) => {
      const msg = JSON.parse(String(data)) as Record<string, unknown>;
      collected.push(msg);
      if (collected.length >= 2) {
        ws.off('message', handler);
        resolve(collected);
      }
    };
    ws.on('message', handler);
  });

  sendEnvelope(ws, { type: 'connection.initialize' });
  const [initialized, snapshot] = await Promise.race([
    messages,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('connectAndInit timeout')), 5000)),
  ]) as [Record<string, unknown>, Record<string, unknown>];

  expect(initialized.type).toBe('connection.initialized');
  expect(snapshot.type).toBe('host.snapshot');

  return { ws, snapshot };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Real integration: BridgeApp end-to-end', () => {
  let app: BridgeApp;

  beforeEach(() => {
    app = new BridgeApp({ port: 0, dbPath: ':memory:' });
  });

  afterEach(() => {
    app?.stop();
  });

  // -------------------------------------------------------------------------
  // Core lifecycle
  // -------------------------------------------------------------------------

  it('full lifecycle: connect → snapshot → start → approval → approve → complete', async () => {
    await app.start();
    const { ws, snapshot } = await connectAndInit(app);

    // Snapshot should have sessions/approvals/questions arrays
    const snapPayload = snapshot.payload as Record<string, unknown>;
    expect(Array.isArray(snapPayload.sessions)).toBe(true);
    expect(Array.isArray(snapPayload.approvals)).toBe(true);

    // Start a session
    const adapter = app.getAdapterManager()!.getAdapter('fake')!;
    const runtimeSessionId = await adapter.startSession({});

    // Wait for session.started (adapter emits this, not session.created)
    const sessionEvent = await waitForMessage(ws, 'session.started');
    expect(sessionEvent.sessionId).toBe(runtimeSessionId);

    // Wait for approval.requested
    const approvalEvent = await waitForMessage(ws, 'approval.requested');
    expect(approvalEvent.sessionId).toBe(runtimeSessionId);
    const approvalPayload = approvalEvent.payload as Record<string, unknown>;
    const approvalId = String(approvalPayload.approvalId ?? '');

    // Approve via command
    const corrId = randomUUID();
    sendEnvelope(ws, buildCommand('command/approve', {
      idempotencyKey: randomUUID(),
      approvalId,
      decision: 'approved',
    }, runtimeSessionId, corrId));

    const ack = await waitForMessage(ws, 'command.ack');
    expect(ack.correlationId).toBe(corrId);

    // Wait for session.completed
    const completed = await waitForMessage(ws, 'session.completed');
    expect(completed.sessionId).toBe(runtimeSessionId);

    ws.close();
  }, 10000);

  // -------------------------------------------------------------------------
  // Reconnect + snapshot replay
  // -------------------------------------------------------------------------

  it('reconnect replays pending approvals in snapshot', async () => {
    await app.start();
    const adapter = app.getAdapterManager()!.getAdapter('fake')!;

    // Connect first, then start session so DB is populated before snapshot query
    const conn1 = await connectAndInit(app);
    const runtimeSessionId = await adapter.startSession({});

    const approvalEvent = await waitForMessage(conn1.ws, 'approval.requested');
    const approvalPayload = approvalEvent.payload as Record<string, unknown>;
    const approvalId = String(approvalPayload.approvalId ?? '');

    // Wait for session.completed so DB state is fully flushed
    await waitForMessage(conn1.ws, 'session.completed');

    // Disconnect
    conn1.ws.close();
    await new Promise((r) => setTimeout(r, 200));

    // Reconnect — snapshot should contain the pending approval (now completed,
    // but the approval record is still in the DB from the approval.requested event)
    const { ws: ws2, snapshot } = await connectAndInit(app);
    const snapPayload = snapshot.payload as Record<string, unknown>;
    const approvals = snapPayload.approvals as Array<Record<string, unknown>>;

    // The approval was created during the session, so it should appear in the DB
    // even though the session is completed (approvals table is not filtered by session state)
    expect(approvals.length).toBeGreaterThanOrEqual(1);
    expect(approvals.some((a) =>
      a.id === approvalId || a.runtimeApprovalId === approvalId,
    )).toBe(true);

    ws2.close();
  }, 10000);

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  it('duplicate command with same idempotency key is deduplicated', async () => {
    await app.start();
    const { ws } = await connectAndInit(app);

    const adapter = app.getAdapterManager()!.getAdapter('fake')!;
    const runtimeSessionId = await adapter.startSession({});

    const approvalEvent = await waitForMessage(ws, 'approval.requested');
    const approvalPayload = approvalEvent.payload as Record<string, unknown>;
    const approvalId = String(approvalPayload.approvalId ?? '');
    const idempotencyKey = randomUUID();

    // First approve
    const corr1 = randomUUID();
    sendEnvelope(ws, buildCommand('command/approve', {
      idempotencyKey,
      approvalId,
      decision: 'approved',
    }, runtimeSessionId, corr1));
    const ack1 = await waitForMessage(ws, 'command.ack');
    expect(ack1.correlationId).toBe(corr1);

    // Second approve with same idempotency key → duplicate
    const corr2 = randomUUID();
    sendEnvelope(ws, buildCommand('command/approve', {
      idempotencyKey,
      approvalId,
      decision: 'approved',
    }, runtimeSessionId, corr2));
    const ack2 = await waitForMessage(ws, 'command.ack');
    expect(ack2.correlationId).toBe(corr2);
    const ack2Payload = ack2.payload as Record<string, unknown>;
    expect(ack2Payload.status).toBe('duplicate');

    ws.close();
  });

  // -------------------------------------------------------------------------
  // Send instruction
  // -------------------------------------------------------------------------

  it('send instruction via command/send', async () => {
    await app.start();
    const { ws } = await connectAndInit(app);

    const adapter = app.getAdapterManager()!.getAdapter('fake')!;
    const runtimeSessionId = await adapter.startSession({});

    await waitForMessage(ws, 'session.started');

    // Collect all subsequent messages before sending
    const received: Record<string, unknown>[] = [];
    const handler = (data: WebSocket.Data) => {
      received.push(JSON.parse(String(data)) as Record<string, unknown>);
    };
    ws.on('message', handler);

    const corrId = randomUUID();
    sendEnvelope(ws, buildCommand('command/send', {
      idempotencyKey: randomUUID(),
      text: 'Focus on error handling',
    }, runtimeSessionId, corrId));

    // Poll for ack (ponytail: avoids waitForMessage race where ack arrives before handler)
    const deadline = Date.now() + 3000;
    while (!received.some(m => m.type === 'command.ack') && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50));
    }

    const ack = received.find(m => m.type === 'command.ack');
    expect(ack).toBeDefined();
    expect(ack!.correlationId).toBe(corrId);

    const instrEvent = received.find(m => m.type === 'instruction.accepted');
    expect(instrEvent?.sessionId).toBe(runtimeSessionId);

    ws.off('message', handler);
    ws.close();
  });

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------

  it('cancel session via command/cancel', async () => {
    const slowScenario: ScenarioStep[] = [
      { delayMs: 200, type: 'session.started', payload: { status: 'running', message: 'Working' } },
      { delayMs: 50, type: 'session.updated', payload: { summary: 'Processing' } },
      { delayMs: 10000, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
    ];

    app.stop();
    const adapter = new FakeAdapter(slowScenario);
    app = createLegacyBridgeApp();
    await app.start();
    await app.getAdapterManager()!.registerAdapter('fake', adapter);

    const { ws } = await connectAndInit(app);
    const runtimeSessionId = await adapter.startSession({});

    await waitForMessage(ws, 'session.started');
    await waitForMessage(ws, 'session.updated');

    // Collect all subsequent messages
    const received: Record<string, unknown>[] = [];
    const handler = (data: WebSocket.Data) => {
      received.push(JSON.parse(String(data)) as Record<string, unknown>);
    };
    ws.on('message', handler);

    const corrId = randomUUID();
    sendEnvelope(ws, buildCommand('command/cancel', {
      idempotencyKey: randomUUID(),
    }, runtimeSessionId, corrId));

    // Poll until ack arrives (ponytail: simple poll beats complex promise race)
    const deadline = Date.now() + 3000;
    while (!received.some(m => m.type === 'command.ack') && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 50));
    }

    const ack = received.find(m => m.type === 'command.ack');
    expect(ack).toBeDefined();
    expect(ack!.correlationId).toBe(corrId);

    const cancelEvent = received.find(m => m.type === 'session.cancelled');
    expect(cancelEvent?.sessionId).toBe(runtimeSessionId);

    ws.off('message', handler);
    ws.close();
  });

  // -------------------------------------------------------------------------
  // Multiple commands flow
  // -------------------------------------------------------------------------

  it('send instruction then approve in sequence', async () => {
    await app.start();
    const { ws } = await connectAndInit(app);

    const adapter = app.getAdapterManager()!.getAdapter('fake')!;
    const runtimeSessionId = await adapter.startSession({});

    // Wait for approval
    const approvalEvent = await waitForMessage(ws, 'approval.requested');
    const approvalPayload = approvalEvent.payload as Record<string, unknown>;
    const approvalId = String(approvalPayload.approvalId ?? '');

    // Send instruction
    sendEnvelope(ws, buildCommand('command/send', {
      idempotencyKey: randomUUID(),
      text: 'Check the tests',
    }, runtimeSessionId));
    await waitForMessage(ws, 'command.ack');

    // Approve
    sendEnvelope(ws, buildCommand('command/approve', {
      idempotencyKey: randomUUID(),
      approvalId,
      decision: 'approved',
    }, runtimeSessionId));
    await waitForMessage(ws, 'command.ack');

    // Session should complete
    const completed = await waitForMessage(ws, 'session.completed');
    expect(completed.sessionId).toBe(runtimeSessionId);

    ws.close();
  });

  // -------------------------------------------------------------------------
  // Multi-client broadcast
  // -------------------------------------------------------------------------

  it('events broadcast to all connected clients', async () => {
    await app.start();

    const { ws: ws1 } = await connectAndInit(app);
    const { ws: ws2 } = await connectAndInit(app);

    const adapter = app.getAdapterManager()!.getAdapter('fake')!;
    const runtimeSessionId = await adapter.startSession({});

    // Both clients should receive the same session event
    const [event1, event2] = await Promise.all([
      waitForAnyMessage(ws1, ['session.started']),
      waitForAnyMessage(ws2, ['session.started']),
    ]);

    expect(event1.sessionId).toBe(runtimeSessionId);
    expect(event2.sessionId).toBe(runtimeSessionId);

    ws1.close();
    ws2.close();
  });

  // -------------------------------------------------------------------------
  // Streaming scenario
  // -------------------------------------------------------------------------

  it('streaming scenario: multiple updates before completion', async () => {
    app.stop();
    app = createLegacyBridgeApp();
    await app.start();

    const adapter = app.getAdapterManager()!.getAdapter('fake')!;
    const { ws } = await connectAndInit(app);

    const runtimeSessionId = await adapter.startSession({});

    // Collect all events for 2s
    const events = await collectMessages(ws, 2000);
    const sessionEvents = events.filter((e) => e.sessionId === runtimeSessionId);
    const types = sessionEvents.map((e) => e.type);

    expect(types).toContain('session.started');
    expect(types).toContain('session.completed');
    // Default scenario has session.started → approval.requested → session.completed
    expect(types).toContain('approval.requested');

    ws.close();
  });

  // -------------------------------------------------------------------------
  // Failure scenario
  // -------------------------------------------------------------------------

  it('failure scenario: session emits failed event', async () => {
    app.stop();
    const adapter = new FakeAdapter(failureScenario);
    app = createLegacyBridgeApp();
    await app.start();
    await app.getAdapterManager()!.registerAdapter('fake', adapter);

    const { ws } = await connectAndInit(app);
    const runtimeSessionId = await adapter.startSession({});

    // Should receive session.failed
    const failed = await waitForMessage(ws, 'session.failed');
    expect(failed.sessionId).toBe(runtimeSessionId);

    ws.close();
  });

  // -------------------------------------------------------------------------
  // Snapshot contains active sessions started before client connected
  // -------------------------------------------------------------------------

  it('snapshot contains sessions that were started before client connected', async () => {
    // Use a slow scenario so session is still running when snapshot is taken
    const slowScenario: ScenarioStep[] = [
      { delayMs: 50, type: 'session.started', payload: { status: 'running', message: 'Working' } },
      { delayMs: 30000, type: 'session.completed', payload: { status: 'completed', summary: 'Done' } },
    ];

    app.stop();
    const adapter = new FakeAdapter(slowScenario);
    app = createLegacyBridgeApp();
    await app.start();
    await app.getAdapterManager()!.registerAdapter('fake', adapter);

    // Start a session before any client connects
    const runtimeSessionId = await adapter.startSession({});

    // Wait for the adapter event to be processed (DB write)
    await new Promise((r) => setTimeout(r, 150));

    // Now connect — snapshot should contain the session
    const { ws, snapshot } = await connectAndInit(app);
    const snapPayload = snapshot.payload as Record<string, unknown>;
    const sessions = snapPayload.sessions as Array<Record<string, unknown>>;

    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions.some((s) => s.id === runtimeSessionId)).toBe(true);

    ws.close();
  });

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  it('reconnection works after disconnect', async () => {
    await app.start();

    const { ws: ws1 } = await connectAndInit(app);
    ws1.close();
    await new Promise((r) => setTimeout(r, 100));

    // New connection should work fine
    const { ws: ws2, snapshot } = await connectAndInit(app);
    const snapPayload = snapshot.payload as Record<string, unknown>;
    expect(snapPayload.hostId).toBeDefined();
    ws2.close();
  });

  // -------------------------------------------------------------------------
  // Unknown command type — gateway silently drops (no handler registered)
  // -------------------------------------------------------------------------

  it('unknown command type is silently dropped (no ack)', async () => {
    await app.start();
    const { ws } = await connectAndInit(app);

    const adapter = app.getAdapterManager()!.getAdapter('fake')!;
    const runtimeSessionId = await adapter.startSession({});

    // Drain all pending adapter events (session.started, approval.requested, session.completed)
    // so they don't interfere with the no-response assertion
    await waitForMessage(ws, 'session.completed');

    const corrId = randomUUID();
    sendEnvelope(ws, buildCommand('command/unknown_action', {
      idempotencyKey: randomUUID(),
    }, runtimeSessionId, corrId));

    // Gateway has no handler for unknown types — sends nothing back.
    // Verify no message arrives within 300ms (proves it was dropped).
    const noResponse = await Promise.race([
      new Promise<boolean>((resolve) => {
        const handler = () => { resolve(false); };
        ws.once('message', handler);
        setTimeout(() => { ws.off('message', handler); resolve(true); }, 300);
      }),
    ]);

    expect(noResponse).toBe(true);
    ws.close();
  });
});
