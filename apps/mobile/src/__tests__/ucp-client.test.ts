/**
 * ucp-client.test.ts
 *
 * Tests the UcpClient service with a mocked WebSocket.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

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

  /** Test helper — simulate server sending a message. */
  simulateMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  /** Test helper — simulate successful open. */
  simulateOpen() {
    this.onopen?.();
  }
}

// Patch global WebSocket before importing UcpClient
const mockWsInstance = new MockWebSocket();
const MockWebSocketCtor = vi.fn(() => mockWsInstance);
// @ts-expect-error — patching global for tests
global.WebSocket = MockWebSocketCtor;
// @ts-expect-error
global.WebSocket.OPEN = MockWebSocket.OPEN;

// Import after patching
import { UcpClient } from "../services/ucp-client.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockWsInstance.sentMessages = [];
  mockWsInstance.readyState = MockWebSocket.OPEN;
  mockWsInstance.onopen = null;
  mockWsInstance.onmessage = null;
  mockWsInstance.onclose = null;
  mockWsInstance.onerror = null;
  MockWebSocketCtor.mockClear();
});

describe("UcpClient.connect", () => {
  it("opens a WebSocket to the provided URL", () => {
    const client = new UcpClient("ws://localhost:8765", {
      onEvent: () => undefined,
      onConnected: () => undefined,
      onDisconnected: () => undefined,
      onError: () => undefined,
    });
    client.connect();
    expect(MockWebSocketCtor).toHaveBeenCalledWith("ws://localhost:8765");
  });

  it("sends the connection.initialize handshake on open — and nothing before", () => {
    const client = new UcpClient("ws://localhost:8765", {
      onEvent: () => undefined,
      onConnected: () => undefined,
      onDisconnected: () => undefined,
      onError: () => undefined,
    });
    client.connect();
    // Nothing sent before onopen fires
    expect(mockWsInstance.sentMessages).toHaveLength(0);

    mockWsInstance.simulateOpen();

    expect(mockWsInstance.sentMessages).toHaveLength(1);
    const msg = JSON.parse(mockWsInstance.sentMessages[0]!) as Record<string, unknown>;
    expect(msg["type"]).toBe("connection.initialize");
    expect(msg["protocol"]).toBe("ucp");
  });

  it("does not open a second socket when already connecting", () => {
    const client = new UcpClient("ws://localhost:8765", {
      onEvent: () => undefined,
      onConnected: () => undefined,
      onDisconnected: () => undefined,
      onError: () => undefined,
    });
    client.connect();
    client.connect(); // second call should be ignored
    expect(MockWebSocketCtor).toHaveBeenCalledTimes(1);
  });
});

describe("UcpClient.disconnect", () => {
  it("closes the WebSocket and sets status to closed", () => {
    const client = new UcpClient("ws://localhost:8765", {
      onEvent: () => undefined,
      onConnected: () => undefined,
      onDisconnected: () => undefined,
      onError: () => undefined,
    });
    client.connect();
    mockWsInstance.simulateOpen();
    client.disconnect();
    expect(client.getStatus()).toBe("closed");
  });

  it("does not trigger reconnect after intentional disconnect", () => {
    const onDisconnected = vi.fn();
    const client = new UcpClient("ws://localhost:8765", {
      onEvent: () => undefined,
      onConnected: () => undefined,
      onDisconnected,
      onError: () => undefined,
    });
    client.connect();
    mockWsInstance.simulateOpen();
    client.disconnect();
    // onDisconnected should NOT be called for intentional close
    expect(onDisconnected).not.toHaveBeenCalled();
  });
});

describe("UcpClient inbound messages", () => {
  it("calls onConnected when connection.initialized is received", () => {
    const onConnected = vi.fn<(hostId: string) => void>();
    const client = new UcpClient("ws://localhost:8765", {
      onEvent: () => undefined,
      onConnected,
      onDisconnected: () => undefined,
      onError: () => undefined,
    });
    client.connect();
    mockWsInstance.simulateOpen();
    mockWsInstance.simulateMessage(
      JSON.stringify({
        type: "connection.initialized",
        payload: { hostId: "host_abc", selectedVersion: 1 },
      })
    );
    expect(onConnected).toHaveBeenCalledWith("host_abc");
  });

  it("dispatches other message types as UcpEvents", () => {
    const onEvent = vi.fn();
    const client = new UcpClient("ws://localhost:8765", {
      onEvent,
      onConnected: () => undefined,
      onDisconnected: () => undefined,
      onError: () => undefined,
    });
    client.connect();
    mockWsInstance.simulateOpen();
    mockWsInstance.simulateMessage(
      JSON.stringify({
        type: "session.created",
        payload: { id: "ses_1", title: "Test" },
      })
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "session.created" })
    );
  });

  it("silently ignores malformed JSON frames", () => {
    const onEvent = vi.fn();
    const client = new UcpClient("ws://localhost:8765", {
      onEvent,
      onConnected: () => undefined,
      onDisconnected: () => undefined,
      onError: () => undefined,
    });
    client.connect();
    mockWsInstance.simulateOpen();
    mockWsInstance.simulateMessage("not json {{{");
    expect(onEvent).not.toHaveBeenCalled();
  });
});
