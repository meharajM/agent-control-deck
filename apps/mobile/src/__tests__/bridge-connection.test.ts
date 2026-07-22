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

  simulateError() {
    this.onerror?.();
  }
}

const mockWsInstance = new MockWebSocket();
const MockWebSocketCtor = vi.fn(() => mockWsInstance);
// @ts-expect-error — patching global for tests
global.WebSocket = MockWebSocketCtor;
// @ts-expect-error
global.WebSocket.OPEN = MockWebSocket.OPEN;

import { useConnectionStore } from "../store/connection-store.js";
import { useSessionStore } from "../store/session-store.js";
import {
  connectToBridge,
  disconnectFromBridge,
  sendCommand,
} from "../services/bridge-connection.js";

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

describe("connectToBridge", () => {
  it("sets connection store to connecting and opens WebSocket", () => {
    connectToBridge("ws://localhost:8765");
    expect(MockWebSocketCtor).toHaveBeenCalledWith("ws://localhost:8765");
    expect(useConnectionStore.getState().status).toBe("connecting");
    expect(useConnectionStore.getState().bridgeUrl).toBe("ws://localhost:8765");
  });

  it("wires connection.initialized to connection store", () => {
    connectToBridge("ws://localhost:8765");
    mockWsInstance.simulateOpen();
    mockWsInstance.simulateMessage(
      JSON.stringify({
        type: "connection.initialized",
        payload: { hostId: "host_abc", selectedVersion: 1 },
      })
    );
    expect(useConnectionStore.getState().status).toBe("connected");
    expect(useConnectionStore.getState().hostId).toBe("host_abc");
    expect(useSessionStore.getState().connectionStatus).toBe("connected");
  });

  it("wires inbound events to session store", () => {
    connectToBridge("ws://localhost:8765");
    mockWsInstance.simulateOpen();
    mockWsInstance.simulateMessage(
      JSON.stringify({
        type: "session.created",
        payload: {
          id: "ses_1",
          title: "Test session",
          state: "running",
          summary: "",
          version: 1,
          createdAt: "2026-07-19T00:00:00.000Z",
          updatedAt: "2026-07-19T00:00:00.000Z",
        },
      })
    );
    expect(useSessionStore.getState().sessions["ses_1"]?.title).toBe("Test session");
  });

  it("wires onclose to marking stale and setting reconnecting", () => {
    connectToBridge("ws://localhost:8765");
    mockWsInstance.simulateOpen();
    mockWsInstance.close();
    expect(useSessionStore.getState().connectionStatus).toBe("stale");
    expect(useConnectionStore.getState().status).toBe("reconnecting");
  });
});

describe("disconnectFromBridge", () => {
  it("closes socket and resets both stores", () => {
    connectToBridge("ws://localhost:8765");
    mockWsInstance.simulateOpen();
    disconnectFromBridge();
    expect(useConnectionStore.getState().status).toBe("idle");
    expect(useSessionStore.getState().sessions).toEqual({});
  });
});

describe("sendCommand", () => {
  it("sends a JSON envelope when connected", () => {
    connectToBridge("ws://localhost:8765");
    mockWsInstance.simulateOpen();
    sendCommand("command/approve", { approvalId: "apr_1" });
    expect(mockWsInstance.sentMessages).toHaveLength(2); // init + command
    const envelope = JSON.parse(mockWsInstance.sentMessages[1]!);
    expect(envelope.type).toBe("command/approve");
    expect(envelope.payload.approvalId).toBe("apr_1");
    expect(envelope.protocol).toBe("ucp");
  });

  it("throws when not connected", () => {
    expect(() => sendCommand("command/approve", {})).toThrow("not connected");
  });
});
