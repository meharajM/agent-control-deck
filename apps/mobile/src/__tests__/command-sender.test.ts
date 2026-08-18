import { beforeEach, describe, expect, it, vi } from "vitest";

type WsEventHandler = (evt?: unknown) => void;

class MockWebSocket {
  static OPEN = 1 as const;
  static CLOSED = 3 as const;
  readyState: number = MockWebSocket.OPEN;
  onopen: WsEventHandler | null = null;
  onmessage: WsEventHandler | null = null;
  onclose: WsEventHandler | null = null;
  onerror: WsEventHandler | null = null;
  sentMessages: string[] = [];

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  simulateOpen() {
    this.onopen?.();
  }
}

const mockWsInstance = new MockWebSocket();
const MockWebSocketCtor = vi.fn(() => mockWsInstance);
// @ts-expect-error — patching global for tests
global.WebSocket = MockWebSocketCtor;
// @ts-expect-error
global.WebSocket.OPEN = MockWebSocket.OPEN;

import { disconnectFromBridge, connectToBridge } from "../services/bridge-connection.js";
import { useConnectionStore } from "../store/connection-store.js";
import { useSessionStore } from "../store/session-store.js";
import {
  approveApproval,
  sendInstruction,
  cancelSession,
  focusSession,
} from "../services/command-sender.js";

beforeEach(() => {
  disconnectFromBridge();
  mockWsInstance.sentMessages = [];
  mockWsInstance.readyState = MockWebSocket.OPEN;
  mockWsInstance.onopen = null;
  mockWsInstance.onmessage = null;
  mockWsInstance.onclose = null;
  mockWsInstance.onerror = null;
  MockWebSocketCtor.mockClear();
  useSessionStore.getState().reset();
  useConnectionStore.getState().disconnect();
});

function connectAndOpen() {
  connectToBridge("ws://localhost:8765");
  mockWsInstance.simulateOpen();
  mockWsInstance.simulateMessage(
    JSON.stringify({
      type: "connection.initialized",
      payload: { hostId: "host_1", selectedVersion: 1 },
    })
  );
}

function getCommandEnvelopes() {
  return mockWsInstance.sentMessages
    .slice(1) // skip connection.initialize
    .map((raw) => JSON.parse(raw));
}

describe("approveApproval", () => {
  it("sends command/approve with correct envelope", () => {
    connectAndOpen();
    approveApproval("apr_1", "approved", 3);
    const envelopes = getCommandEnvelopes();
    expect(envelopes).toHaveLength(1);
    const env = envelopes[0]!;
    expect(env.type).toBe("command/approve");
    expect(env.protocol).toBe("ucp");
    expect(env.payload.approvalId).toBe("apr_1");
    expect(env.payload.decision).toBe("approved");
    expect(env.payload.expectedVersion).toBe(3);
    expect(typeof env.payload.idempotencyKey).toBe("string");
    expect(env.payload.idempotencyKey.length).toBeGreaterThan(0);
  });

  it("generates unique idempotency keys per call", () => {
    connectAndOpen();
    approveApproval("apr_1", "approved", 1);
    approveApproval("apr_2", "rejected", 1);
    const envelopes = getCommandEnvelopes();
    expect(envelopes).toHaveLength(2);
    expect(envelopes[0]!.payload.idempotencyKey).not.toBe(
      envelopes[1]!.payload.idempotencyKey
    );
  });

  it("throws when not connected", () => {
    expect(() => approveApproval("apr_1", "approved", 1)).toThrow("not connected");
  });
});

describe("sendInstruction", () => {
  it("sends command/send with correct envelope", () => {
    connectAndOpen();
    sendInstruction("ses_1", "fix the bug");
    const envelopes = getCommandEnvelopes();
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]!.type).toBe("command/send");
    expect(envelopes[0]!.payload.sessionId).toBe("ses_1");
    expect(envelopes[0]!.payload.text).toBe("fix the bug");
    expect(typeof envelopes[0]!.payload.idempotencyKey).toBe("string");
  });

  it("throws when not connected", () => {
    expect(() => sendInstruction("ses_1", "hello")).toThrow("not connected");
  });
});

describe("cancelSession", () => {
  it("sends command/cancel with correct envelope", () => {
    connectAndOpen();
    cancelSession("ses_1");
    const envelopes = getCommandEnvelopes();
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]!.type).toBe("command/cancel");
    expect(envelopes[0]!.payload.sessionId).toBe("ses_1");
    expect(typeof envelopes[0]!.payload.idempotencyKey).toBe("string");
  });

  it("throws when not connected", () => {
    expect(() => cancelSession("ses_1")).toThrow("not connected");
  });
});

describe("focusSession", () => {
  it("sends session.focus with a trackable command ID", () => {
    connectAndOpen();
    const commandId = focusSession("ses_1");
    const envelopes = getCommandEnvelopes();
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]!.type).toBe("session.focus");
    expect(envelopes[0]!.payload.sessionId).toBe("ses_1");
    expect(envelopes[0]!.payload.commandId).toBe(commandId);
  });
});
