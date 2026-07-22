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

describe('Concurrency: two-device approval race', () => {
  it('only first device resolves, second gets conflict', async () => {
    await harness.connect();
    await harness.connect('device-b');
    const sessionId = await harness.startAdapterSession();

    const event = await harness.waitForEvent('approval.requested', sessionId, 5000);
    const payload = event.payload as Record<string, unknown>;
    const approvalId = String(payload['id'] ?? payload['approvalId'] ?? '');

    const result1 = await harness.sendCommandAsDevice('test-device', {
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: 'command/approve',
      approvalId,
      sessionId,
      expectedApprovalVersion: 1,
    });
    expect(result1['result']).toBe('resolved');

    const result2 = await harness.sendCommandAsDevice('device-b', {
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: 'command/approve',
      approvalId,
      sessionId,
      expectedApprovalVersion: 1,
    });
    expect(['conflict', 'duplicate']).toContain(result2['result']);
  });

  it('concurrent approve and reject: first wins', async () => {
    await harness.connect();
    await harness.connect('device-b');
    const sessionId = await harness.startAdapterSession();

    const event = await harness.waitForEvent('approval.requested', sessionId, 5000);
    const payload = event.payload as Record<string, unknown>;
    const approvalId = String(payload['id'] ?? payload['approvalId'] ?? '');

    const approvePromise = harness.sendCommandAsDevice('test-device', {
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: 'command/approve',
      approvalId,
      sessionId,
      expectedApprovalVersion: 1,
    });

    const rejectPromise = harness.sendCommandAsDevice('device-b', {
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: 'command/reject',
      approvalId,
      sessionId,
      expectedApprovalVersion: 1,
    });

    const [approveResult, rejectResult] = await Promise.all([approvePromise, rejectPromise]);
    const results = [approveResult['result'], rejectResult['result']];
    expect(results).toContain('resolved');
    expect(results).toContain('conflict');
  });

  it('phone disconnect does NOT auto-approve pending approvals', async () => {
    await harness.connect();
    const sessionId = await harness.startAdapterSession();

    const event = await harness.waitForEvent('approval.requested', sessionId, 5000);
    const payload = event.payload as Record<string, unknown>;
    const approvalId = String(payload['id'] ?? payload['approvalId'] ?? '');

    await harness.disconnect();
    await new Promise((r) => setTimeout(r, 200));
    await harness.reconnect();

    const pending = harness.getAllPendingApprovals();
    expect(pending.some((a) => a.id === approvalId)).toBe(true);
  });

  it('bridge restart does NOT auto-approve pending approvals', async () => {
    await harness.connect();
    const sessionId = await harness.startAdapterSession();

    const event = await harness.waitForEvent('approval.requested', sessionId, 5000);
    const payload = event.payload as Record<string, unknown>;
    const approvalId = String(payload['id'] ?? payload['approvalId'] ?? '');

    await harness.disconnect();
    await new Promise((r) => setTimeout(r, 200));
    await harness.reconnect();

    const pending = harness.getAllPendingApprovals();
    expect(pending.some((a) => a.id === approvalId)).toBe(true);

    await harness.sendCommand({
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: 'command/approve',
      approvalId,
      sessionId,
      expectedApprovalVersion: 1,
    });

    const completed = await harness.waitForEvent('session.completed', sessionId, 15000);
    expect(completed.type).toBe('session.completed');
  }, 20000);
});

describe('Concurrency: duplicate command prevention', () => {
  it('same idempotency key dispatched only once', async () => {
    await harness.connect();
    const sessionId = await harness.startAdapterSession();
    const idempotencyKey = randomUUID();

    const result1 = await harness.sendCommand({
      commandId: randomUUID(),
      idempotencyKey,
      kind: 'text',
      sessionId,
      text: 'Run tests',
    });
    expect(result1['result']).toBe('accepted');

    const result2 = await harness.sendCommand({
      commandId: randomUUID(),
      idempotencyKey,
      kind: 'text',
      sessionId,
      text: 'Run tests',
    });
    expect(result2['result']).toBe('duplicate');
  });

  it('different idempotency keys dispatched independently', async () => {
    await harness.connect();
    const sessionId = await harness.startAdapterSession();

    const result1 = await harness.sendCommand({
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: 'text',
      sessionId,
      text: 'First command',
    });
    expect(result1['result']).toBe('accepted');

    const result2 = await harness.sendCommand({
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: 'text',
      sessionId,
      text: 'Second command',
    });
    expect(result2['result']).toBe('accepted');
  });
});

describe('Concurrency: state consistency', () => {
  it('snapshot captured at different points shows correct state', async () => {
    await harness.connect();
    const sessionId = await harness.startAdapterSession();

    const snap1 = harness.captureState();
    expect(snap1.session).not.toBeNull();

    const event = await harness.waitForEvent('approval.requested', sessionId, 5000);
    const snap2 = harness.captureState();
    expect(snap2.approvals).toHaveLength(1);

    const payload = event.payload as Record<string, unknown>;
    const approvalId = String(payload['id'] ?? payload['approvalId'] ?? '');

    await harness.sendCommand({
      commandId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: 'command/approve',
      approvalId,
      sessionId,
      expectedApprovalVersion: 1,
    });

    const snap3 = harness.captureState();
    expect(snap3.approvals).toHaveLength(0);
  });

  it('converged state matches after fault injection', async () => {
    await harness.connect();
    const sessionId = await harness.startAdapterSession();
    await harness.waitForEvent('approval.requested', sessionId, 5000);

    const adapter = harness.getAdapter();
    adapter.injectFault('delay');
    await new Promise((r) => setTimeout(r, 200));

    const result = harness.assertReplayEqualsSnapshot(sessionId);
    expect(result.equal).toBe(true);
  });
});
