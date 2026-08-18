import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { UcpGateway } from '../ucp-gateway.js';
import { asHostId, asMessageId, asSessionId, asTimestamp, type UcpEnvelope } from '@agent-deck/protocol';
import {
  decryptFrame,
  deriveSessionKey,
  encryptFrame,
  generateIdentityKeyPair,
  type EncryptedFrame,
} from '@agent-deck/crypto';
import type { ProbeResult, ReconcileResult, RuntimeAdapter, StartSessionParams } from '@agent-deck/adapter-contract';

function buildEnvelope(type: string, payload: Record<string, unknown>, sessionId = asSessionId('session-1')): UcpEnvelope {
  return {
    protocol: 'ucp',
    version: 1,
    messageId: asMessageId(`test-${Math.random().toString(36).slice(2)}`),
    type,
    timestamp: asTimestamp(new Date().toISOString()),
    hostId: asHostId('test-host'),
    sessionId,
    payload,
  };
}

function waitForFrame(ws: WebSocket, timeout = 2000): Promise<EncryptedFrame> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for frame')), timeout);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)) as EncryptedFrame);
    });
  });
}

function waitForClose(ws: WebSocket, timeout = 2000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for close')), timeout);
    ws.once('close', (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: String(reason) });
    });
  });
}

function waitForMessages(ws: WebSocket, count: number, timeout = 2000): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const messages: unknown[] = [];
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('timeout waiting for messages'));
    }, timeout);
    const onMessage = (data: WebSocket.RawData) => {
      messages.push(JSON.parse(String(data)) as unknown);
      if (messages.length >= count) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(messages);
      }
    };
    ws.on('message', onMessage);
  });
}

function createFakeDb() {
  return createFakeDbWithEvents();
}

function createFakeDbWithEvents(
  eventRows: Array<{ sequence: number; type: string; payload_json: string; session_id: string | null }> = [],
) {
  return {
    prepare(sql: string) {
      if (sql.includes('FROM event_journal') && sql.includes('MAX(sequence)')) {
        return {
          get: () => ({ seq: eventRows.at(-1)?.sequence ?? 0 }),
          all: () => [],
          run: () => ({ changes: 0 }),
        };
      }

      if (sql.includes('FROM event_journal')) {
        return {
          get: () => undefined,
          all: ({ afterSequence }: { afterSequence: number }) =>
            eventRows.filter((row) => row.sequence > afterSequence),
          run: () => ({ changes: 0 }),
        };
      }

      if (sql.includes('FROM sessions')) {
        return {
          get: () => undefined,
          all: () => [],
          run: () => ({ changes: 0 }),
        };
      }

      if (sql.includes('FROM approvals')) {
        return {
          get: () => undefined,
          all: () => [],
          run: () => ({ changes: 0 }),
        };
      }

      if (sql.includes('FROM questions')) {
        return {
          get: () => undefined,
          all: () => [],
          run: () => ({ changes: 0 }),
        };
      }

      if (sql.includes('INSERT OR IGNORE INTO devices')) {
        return {
          run: () => ({ changes: 1 }),
        };
      }

      throw new Error(`Unhandled SQL in gateway fake DB: ${sql}`);
    },
  };
}

class RoutingTestAdapter extends EventEmitter implements RuntimeAdapter {
  readonly runtimeType = 'opencode' as const;
  readonly adapterVersion = 'test';
  readonly sendInstructionCalls: Array<{ sessionId: string; text: string; idempotencyKey: string }> = [];
  readonly resolveApprovalCalls: Array<{ sessionId: string; approvalId: string; decision: string; idempotencyKey: string }> = [];
  readonly cancelSessionCalls: Array<{ sessionId: string; idempotencyKey: string }> = [];
  readonly answerQuestionCalls: Array<{ sessionId: string; questionId: string; answer: unknown; idempotencyKey: string }> = [];

  async probe(): Promise<ProbeResult> {
    return { available: true, version: 'test' };
  }

  async startSession(_params: StartSessionParams): Promise<string> {
    return 'session-from-start';
  }

  async sendInstruction(sessionId: string, text: string, idempotencyKey: string): Promise<void> {
    this.sendInstructionCalls.push({ sessionId, text, idempotencyKey });
  }

  async cancelSession(sessionId: string, idempotencyKey: string): Promise<void> {
    this.cancelSessionCalls.push({ sessionId, idempotencyKey });
  }

  async resolveApproval(sessionId: string, approvalId: string, decision: string, idempotencyKey: string): Promise<void> {
    this.resolveApprovalCalls.push({ sessionId, approvalId, decision, idempotencyKey });
  }

  async answerQuestion(sessionId: string, questionId: string, answer: unknown, idempotencyKey: string): Promise<void> {
    this.answerQuestionCalls.push({ sessionId, questionId, answer, idempotencyKey });
  }

  async reconcile(): Promise<ReconcileResult> {
    return { sessionExists: true, state: 'running' };
  }

  async dispose(): Promise<void> {
    this.removeAllListeners();
  }
}

describe('UcpGateway secure mode', () => {
  let gateway: UcpGateway | undefined;

  afterEach(() => {
    gateway?.stop();
  });

  async function createGateway(
    eventRows: Array<{ sequence: number; type: string; payload_json: string; session_id: string | null }> = [],
  ) {
    const hostKeys = await generateIdentityKeyPair();
    const pairedDevices = new Map<string, { deviceId: string; devicePublicKey: string; deviceName: string }>();
    const revokedKeys = new Set<string>();
    const pairingNonces = new Set(['pairing-nonce-1']);

    gateway = new UcpGateway({
      port: 0,
      hostId: asHostId('test-host'),
      hostName: 'QA Bridge',
      hostPublicKey: hostKeys.publicKeyBase64,
      hostPrivateKey: hostKeys.privateKeyBase64,
      commandLedger: {
        accept: () => 'accepted',
        markDispatched: () => undefined,
        markComplete: () => undefined,
        markFailed: () => undefined,
      } as any,
      resolveAdapter: () => undefined,
      snapshots: {} as any,
      journal: {} as any,
      db: createFakeDbWithEvents(eventRows) as any,
      validateDevice: (devicePublicKey) => pairedDevices.get(devicePublicKey) ?? null,
      completePairing: (devicePublicKey, deviceName, pairingNonce) => {
        if (!pairingNonces.delete(pairingNonce)) {
          throw new Error('Invalid pairing nonce');
        }
        const grant = {
          deviceId: `device-${pairedDevices.size + 1}`,
          devicePublicKey,
          deviceName,
        };
        pairedDevices.set(devicePublicKey, grant);
        return grant;
      },
      isDeviceRevoked: (devicePublicKey) => revokedKeys.has(devicePublicKey),
    });

    const port = await gateway.start();
    return {
      port,
      hostKeys,
      pairedDevices,
      revokedKeys,
    };
  }

  it('pairs a new device and returns an encrypted initialized frame', async () => {
    const { port, hostKeys, pairedDevices } = await createGateway();
    const deviceKeys = await generateIdentityKeyPair();
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.once('open', resolve));

    ws.send(JSON.stringify({
      type: 'connection.initialize',
      payload: {
        devicePublicKey: deviceKeys.publicKeyBase64,
        deviceName: 'QA iPhone',
        pairingNonce: 'pairing-nonce-1',
      },
    }));

    const frame = await waitForFrame(ws);
    const session = deriveSessionKey(deviceKeys.privateKeyBase64, hostKeys.publicKeyBase64);
    const initialized = decryptFrame(frame, session.sessionKeyBase64) as unknown as UcpEnvelope;

    expect(initialized.type).toBe('connection.initialized');
    expect(initialized.hostId).toBe('test-host');
    expect(pairedDevices.get(deviceKeys.publicKeyBase64)?.deviceName).toBe('QA iPhone');
    ws.close();
  });

  it('returns a plaintext host-key bootstrap for manual endpoint pairing', async () => {
    const { port, hostKeys } = await createGateway();
    const deviceKeys = await generateIdentityKeyPair();
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.once('open', resolve));
    const framesPromise = waitForMessages(ws, 2);

    ws.send(JSON.stringify({
      type: 'connection.initialize',
      payload: {
        devicePublicKey: deviceKeys.publicKeyBase64,
        deviceName: 'Manual Endpoint iPhone',
        pairingNonce: 'pairing-nonce-1',
        requestHostPublicKey: true,
      },
    }));

    const [bootstrap, snapshotFrame] = await framesPromise as [Record<string, unknown>, EncryptedFrame];
    expect(bootstrap.encrypted).toBeUndefined();
    expect((bootstrap.payload as Record<string, unknown>).hostPublicKey).toBe(hostKeys.publicKeyBase64);

    const session = deriveSessionKey(deviceKeys.privateKeyBase64, hostKeys.publicKeyBase64);
    const snapshot = decryptFrame(snapshotFrame, session.sessionKeyBase64) as unknown as UcpEnvelope;
    expect(snapshot.type).toBe('host.snapshot');
    ws.close();
  });

  it.each(['lastAcknowledgedSequence', 'lastSyncSequence'] as const)(
    'replays only events after payload.%s during secure reconnect',
    async (cursorField) => {
      const { port, hostKeys, pairedDevices } = await createGateway([
        {
          sequence: 2,
          type: 'session.updated',
          payload_json: JSON.stringify({ summary: 'older event' }),
          session_id: 'session-1',
        },
        {
          sequence: 5,
          type: 'session.updated',
          payload_json: JSON.stringify({ summary: 'newer event' }),
          session_id: 'session-1',
        },
      ]);
      const deviceKeys = await generateIdentityKeyPair();
      const session = deriveSessionKey(deviceKeys.privateKeyBase64, hostKeys.publicKeyBase64);

      const initialWs = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => initialWs.once('open', resolve));
      initialWs.send(JSON.stringify({
        type: 'connection.initialize',
        payload: {
          devicePublicKey: deviceKeys.publicKeyBase64,
          deviceName: 'Reconnect Test',
          pairingNonce: 'pairing-nonce-1',
        },
      }));
      await waitForFrame(initialWs);
      expect(pairedDevices.has(deviceKeys.publicKeyBase64)).toBe(true);
      const initialClose = waitForClose(initialWs);
      initialWs.close();
      await initialClose;

      const ws = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => ws.once('open', resolve));
      const replayPromise = new Promise<UcpEnvelope>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout waiting for replayed event')), 2000);
        const handleMessage = (data: WebSocket.RawData) => {
          const message = decryptFrame(JSON.parse(String(data)) as EncryptedFrame, session.sessionKeyBase64) as unknown as UcpEnvelope;
          if (message.type === 'session.updated') {
            clearTimeout(timer);
            ws.off('message', handleMessage);
            resolve(message);
          }
        };
        ws.on('message', handleMessage);
      });

      ws.send(JSON.stringify({
        type: 'connection.initialize',
        payload: {
          devicePublicKey: deviceKeys.publicKeyBase64,
          [cursorField]: 3,
        },
      }));

      const replayed = await replayPromise;
      expect(replayed.sequence).toBe(5);
      expect(replayed.payload).toEqual({ summary: 'newer event' });
      ws.close();
    },
  );

  it('rejects an unpaired device without a valid pairing nonce', async () => {
    const { port } = await createGateway();
    const deviceKeys = await generateIdentityKeyPair();
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.once('open', resolve));

    const closePromise = waitForClose(ws);
    ws.send(JSON.stringify({
      type: 'connection.initialize',
      payload: {
        devicePublicKey: deviceKeys.publicKeyBase64,
        deviceName: 'Unknown Device',
      },
    }));

    const closed = await closePromise;
    expect(closed.code).toBe(4003);
  });

  it('rejects replayed encrypted frames by sequence number', async () => {
    const { port, hostKeys } = await createGateway();
    const deviceKeys = await generateIdentityKeyPair();
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.once('open', resolve));

    ws.send(JSON.stringify({
      type: 'connection.initialize',
      payload: {
        devicePublicKey: deviceKeys.publicKeyBase64,
        deviceName: 'Replay Test',
        pairingNonce: 'pairing-nonce-1',
      },
    }));

    await waitForFrame(ws);
    const session = deriveSessionKey(deviceKeys.privateKeyBase64, hostKeys.publicKeyBase64);
    const command = buildEnvelope('command/send', {
      idempotencyKey: 'idem-1',
      text: 'test',
    });
    const encrypted = encryptFrame(command as unknown as Record<string, unknown>, session.sessionKeyBase64, 1);

    ws.send(JSON.stringify(encrypted));
    const closePromise = waitForClose(ws);
    ws.send(JSON.stringify(encrypted));

    const closed = await closePromise;
    expect(closed.code).toBe(4009);
  });

  it('disconnects active clients when their device is revoked', async () => {
    const { port, hostKeys } = await createGateway();
    const deviceKeys = await generateIdentityKeyPair();
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.once('open', resolve));

    ws.send(JSON.stringify({
      type: 'connection.initialize',
      payload: {
        devicePublicKey: deviceKeys.publicKeyBase64,
        deviceName: 'Revocation Test',
        pairingNonce: 'pairing-nonce-1',
      },
    }));

    const frame = await waitForFrame(ws);
    const session = deriveSessionKey(deviceKeys.privateKeyBase64, hostKeys.publicKeyBase64);
    const initialized = decryptFrame(frame, session.sessionKeyBase64) as unknown as UcpEnvelope;
    expect(initialized.type).toBe('connection.initialized');

    const closePromise = waitForClose(ws);
    gateway!.disconnectDevice(deviceKeys.publicKeyBase64, 'Device revoked');
    const closed = await closePromise;

    expect(closed.code).toBe(4005);
    expect(closed.reason).toBe('Device revoked');
  });

  it('broadcasts adapter events as encrypted frames to authenticated clients', async () => {
    const { hostKeys } = await createGateway();
    const deviceKeys = await generateIdentityKeyPair();
    const session = deriveSessionKey(deviceKeys.privateKeyBase64, hostKeys.publicKeyBase64);
    const fakeWs = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
    } as unknown as WebSocket;

    (gateway as any).authenticated.add({
      ws: fakeWs,
      deviceId: 'device-1',
      devicePublicKey: deviceKeys.publicKeyBase64,
      sessionKeyBase64: session.sessionKeyBase64,
      nextSendSequence: 0,
      lastReceivedSequence: 0,
    });

    gateway!.broadcast(buildEnvelope('session.updated', { summary: 'encrypted event' }));

    const capture = (fakeWs as any).send as ReturnType<typeof vi.fn>;
    expect(capture).toHaveBeenCalledTimes(1);
    const rawPayload = capture.mock.calls[0]?.[0];
    expect(rawPayload).toBeDefined();
    const frame = JSON.parse(String(rawPayload)) as EncryptedFrame;
    expect(((frame as unknown) as Record<string, unknown>).type).toBeUndefined();
    expect(frame.encrypted).toBe(true);

    const decrypted = decryptFrame(frame, session.sessionKeyBase64) as unknown as UcpEnvelope;
    expect(decrypted.type).toBe('session.updated');
    expect(decrypted.payload).toEqual({ summary: 'encrypted event' });
  });

  it('binds the websocket server to the configured host', async () => {
    gateway = new UcpGateway({
      port: 0,
      host: '127.0.0.1',
      hostId: asHostId('test-host'),
      hostName: 'QA Bridge',
      commandLedger: {
        accept: () => 'accepted',
        markDispatched: () => undefined,
        markComplete: () => undefined,
        markFailed: () => undefined,
      } as any,
      resolveAdapter: () => undefined,
      snapshots: {} as any,
      journal: {} as any,
      db: createFakeDb() as any,
      allowInsecureLegacyMode: true,
    });

    await gateway.start();

    expect(gateway.host).toBe('127.0.0.1');
  });
});

describe('UcpGateway legacy routing', () => {
  let gateway: UcpGateway | undefined;

  afterEach(() => {
    gateway?.stop();
  });

  it('routes command/start and follow-up session commands to the selected adapter', async () => {
    const adapter = new RoutingTestAdapter();
    const knownSessions = new Set<string>();

    gateway = new UcpGateway({
      port: 0,
      hostId: asHostId('test-host'),
      commandLedger: {
        accept: () => 'accepted',
        markDispatched: () => undefined,
        markComplete: () => undefined,
        markFailed: () => undefined,
      } as any,
      resolveAdapter: (sessionId) => {
        if (!sessionId) return adapter;
        return knownSessions.has(sessionId) ? adapter : undefined;
      },
      registerSession: (sessionId) => {
        knownSessions.add(sessionId);
      },
      snapshots: {} as any,
      journal: {} as any,
      db: createFakeDb() as any,
      allowInsecureLegacyMode: true,
    });

    const port = await gateway.start();
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.once('open', resolve));

    ws.send(JSON.stringify({ type: 'connection.initialize' }));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for initialization')), 2000);
      ws.on('message', function handler(data) {
        const msg = JSON.parse(String(data)) as UcpEnvelope;
        if (msg.type === 'connection.initialized') {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve();
        }
      });
    });

    const startAckPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for start ack')), 2000);
      ws.on('message', function handler(data) {
        const msg = JSON.parse(String(data)) as UcpEnvelope;
        if (msg.type === 'command.ack' && msg.correlationId === 'corr-start') {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(String((msg.payload as Record<string, unknown>).sessionId));
        }
      });
    });

    ws.send(JSON.stringify({
      protocol: 'ucp',
      version: 1,
      messageId: asMessageId('start-message'),
      type: 'command/start',
      timestamp: asTimestamp(new Date().toISOString()),
      hostId: asHostId('test-host'),
      correlationId: 'corr-start',
      payload: {
        idempotencyKey: 'idem-start',
        instruction: 'Start selected runtime',
      },
    }));

    const startedSessionId = await startAckPromise;

    expect(startedSessionId).toBe('session-from-start');

    const sendAckPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for send ack')), 2000);
      ws.on('message', function handler(data) {
        const msg = JSON.parse(String(data)) as UcpEnvelope;
        if (msg.type === 'command.ack' && msg.correlationId === 'corr-send') {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve();
        }
      });
    });

    ws.send(JSON.stringify({
      protocol: 'ucp',
      version: 1,
      messageId: asMessageId('send-message'),
      type: 'command/send',
      timestamp: asTimestamp(new Date().toISOString()),
      hostId: asHostId('test-host'),
      sessionId: startedSessionId,
      correlationId: 'corr-send',
      payload: {
        idempotencyKey: 'idem-send',
        text: 'Follow-up instruction',
      },
    }));

    await sendAckPromise;

    expect(adapter.sendInstructionCalls).toHaveLength(1);
    expect(adapter.sendInstructionCalls[0]?.sessionId).toBe('session-from-start');
    expect(adapter.sendInstructionCalls[0]?.text).toBe('Follow-up instruction');
    expect(adapter.sendInstructionCalls[0]?.idempotencyKey).toBe('idem-send');

    const approveAckPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for approve ack')), 2000);
      ws.on('message', function handler(data) {
        const msg = JSON.parse(String(data)) as UcpEnvelope;
        if (msg.type === 'command.ack' && msg.correlationId === 'corr-approve') {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve();
        }
      });
    });

    ws.send(JSON.stringify({
      protocol: 'ucp',
      version: 1,
      messageId: asMessageId('approve-message'),
      type: 'command/approve',
      timestamp: asTimestamp(new Date().toISOString()),
      hostId: asHostId('test-host'),
      sessionId: startedSessionId,
      correlationId: 'corr-approve',
      payload: {
        idempotencyKey: 'idem-approve',
        approvalId: 'approval-1',
        decision: 'approved',
      },
    }));

    await approveAckPromise;

    expect(adapter.resolveApprovalCalls).toEqual([
      {
        sessionId: startedSessionId,
        approvalId: 'approval-1',
        decision: 'approved',
        idempotencyKey: 'idem-approve',
      },
    ]);

    const cancelAckPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for cancel ack')), 2000);
      ws.on('message', function handler(data) {
        const msg = JSON.parse(String(data)) as UcpEnvelope;
        if (msg.type === 'command.ack' && msg.correlationId === 'corr-cancel') {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve();
        }
      });
    });

    ws.send(JSON.stringify({
      protocol: 'ucp',
      version: 1,
      messageId: asMessageId('cancel-message'),
      type: 'command/cancel',
      timestamp: asTimestamp(new Date().toISOString()),
      hostId: asHostId('test-host'),
      sessionId: startedSessionId,
      correlationId: 'corr-cancel',
      payload: {
        idempotencyKey: 'idem-cancel',
      },
    }));

    await cancelAckPromise;

    expect(adapter.cancelSessionCalls).toEqual([
      {
        sessionId: startedSessionId,
        idempotencyKey: 'idem-cancel',
      },
    ]);

    const answerAckPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for answer ack')), 2000);
      ws.on('message', function handler(data) {
        const msg = JSON.parse(String(data)) as UcpEnvelope;
        if (msg.type === 'command.ack' && msg.correlationId === 'corr-answer') {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve();
        }
      });
    });

    ws.send(JSON.stringify({
      protocol: 'ucp',
      version: 1,
      messageId: asMessageId('answer-message'),
      type: 'command/answer',
      timestamp: asTimestamp(new Date().toISOString()),
      hostId: asHostId('test-host'),
      sessionId: startedSessionId,
      correlationId: 'corr-answer',
      payload: {
        idempotencyKey: 'idem-answer',
        questionId: 'question-1',
        answer: { value: 'yes' },
      },
    }));

    await answerAckPromise;

    expect(adapter.answerQuestionCalls).toEqual([
      {
        sessionId: startedSessionId,
        questionId: 'question-1',
        answer: { value: 'yes' },
        idempotencyKey: 'idem-answer',
      },
    ]);

    ws.close();
  });

  it('replays only events after payload.lastSyncSequence during legacy reconnect', async () => {
    gateway = new UcpGateway({
      port: 0,
      hostId: asHostId('test-host'),
      commandLedger: {
        accept: () => 'accepted',
        markDispatched: () => undefined,
        markComplete: () => undefined,
        markFailed: () => undefined,
      } as any,
      resolveAdapter: () => undefined,
      snapshots: {} as any,
      journal: {} as any,
      db: createFakeDbWithEvents([
        {
          sequence: 2,
          type: 'session.updated',
          payload_json: JSON.stringify({ summary: 'older event' }),
          session_id: 'session-1',
        },
        {
          sequence: 5,
          type: 'session.updated',
          payload_json: JSON.stringify({ summary: 'newer event' }),
          session_id: 'session-1',
        },
      ]) as any,
      allowInsecureLegacyMode: true,
    });

    const port = await gateway.start();
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.once('open', resolve));

    const received: UcpEnvelope[] = [];
    ws.on('message', (data) => {
      received.push(JSON.parse(String(data)) as UcpEnvelope);
    });

    ws.send(JSON.stringify({
      type: 'connection.initialize',
      payload: {
        lastSyncSequence: 3,
      },
    }));

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for replayed event')), 2000);
      const poll = () => {
        const replayed = received.filter((message) => message.type === 'session.updated');
        if (replayed.length === 1) {
          clearTimeout(timer);
          resolve();
          return;
        }
        setTimeout(poll, 10);
      };
      poll();
    });

    const replayed = received.filter((message) => message.type === 'session.updated');
    expect(replayed).toHaveLength(1);
    expect(replayed[0]?.sequence).toBe(5);
    expect(replayed[0]?.payload).toEqual({ summary: 'newer event' });

    ws.close();
  });

  it('preserves plaintext broadcast behavior in explicit legacy mode', async () => {
    gateway = new UcpGateway({
      port: 0,
      hostId: asHostId('test-host'),
      commandLedger: {
        accept: () => 'accepted',
        markDispatched: () => undefined,
        markComplete: () => undefined,
        markFailed: () => undefined,
      } as any,
      resolveAdapter: () => undefined,
      snapshots: {} as any,
      journal: {} as any,
      db: createFakeDb() as any,
      allowInsecureLegacyMode: true,
    });

    const port = await gateway.start();
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.once('open', resolve));

    ws.send(JSON.stringify({ type: 'connection.initialize' }));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for initialization')), 2000);
      ws.on('message', function handler(data) {
        const msg = JSON.parse(String(data)) as UcpEnvelope;
        if (msg.type === 'connection.initialized') {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve();
        }
      });
    });

    const messagePromise = new Promise<UcpEnvelope>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for broadcast')), 2000);
      ws.on('message', function handler(data) {
        const msg = JSON.parse(String(data)) as UcpEnvelope;
        if (msg.type === 'session.updated') {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      });
    });

    gateway.broadcast(buildEnvelope('session.updated', { summary: 'legacy event' }));

    const message = await messagePromise;
    expect(message.type).toBe('session.updated');
    expect(message.payload).toEqual({ summary: 'legacy event' });

    ws.close();
  });
});
