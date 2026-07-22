import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { TestHarness } from '../harness.js';

let harness: TestHarness;

beforeEach(async () => {
  harness = new TestHarness();
  await harness.setup();
});

afterEach(async () => {
  await harness.teardown();
});

describe('TestHarness', () => {
  it('connects and completes handshake', async () => {
    await harness.connect();
    const session = harness.snapshot.getSessionSnapshot('nonexistent');
    expect(session.session).toBeNull();
  });

  it('starts a session and sees session.created event', async () => {
    await harness.connect();
    const sessionId = randomUUID();
    const result = await harness.sendCommand({
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: 'session.start',
      sessionId,
      title: 'Test session',
      state: 'running',
      summary: 'A test',
    });
    expect(result['result']).toBe('accepted');

    const event = await harness.waitForEvent('session.created', sessionId, 5000);
    expect(event.type).toBe('session.created');
    expect(event.sessionId).toBe(sessionId);
  });

  it('receives approval.requested after adapter emits it', async () => {
    await harness.connect();
    await harness.startAdapterSession();
    const event = await harness.waitForEvent('approval.requested', undefined as unknown as string, 5000);
    expect(event.type).toBe('approval.requested');
  });

  it('sends approval decision and resolves', async () => {
    await harness.connect();
    await harness.startAdapterSession();
    const event = await harness.waitForEvent('approval.requested', undefined as unknown as string, 3000);
    const payload = event.payload as Record<string, unknown>;
    const approvalId = (payload['id'] as string) ?? (payload['approvalId'] as string);
    const sessionId = event.sessionId!;

    const result = await harness.sendCommand({
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: 'command/approve',
      approvalId,
      sessionId,
      expectedApprovalVersion: 1,
    });
    expect(result['result']).toBe('resolved');
  });

  it('disconnects and reconnects', async () => {
    await harness.connect();
    await harness.disconnect();
    await harness.reconnect();
  });

  it('tracks multiple connected device sockets independently', async () => {
    await harness.connect();
    await harness.connect('device-b');

    expect(harness.getConnectedDeviceIds().sort()).toEqual(['device-b', 'test-device']);

    await harness.disconnect('device-b');
    expect(harness.getConnectedDeviceIds()).toEqual(['test-device']);
  });

  it('timeout handling for nonexistent event', async () => {
    await harness.connect();
    await expect(
      harness.waitForEvent('nonexistent.event', 'fake-session', 200)
    ).rejects.toThrow('Timeout');
  });
});
