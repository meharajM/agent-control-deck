import type { UcpEvent } from "../types.js";

/** Max reconnect attempts before giving up. */
const MAX_RECONNECT_ATTEMPTS = 5;
/** Base delay in ms — doubled each attempt (1s, 2s, 4s, 8s, 16s). */
const BASE_DELAY_MS = 1000;

export type UcpClientStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

export interface UcpClientCallbacks {
  onEvent(event: UcpEvent): void;
  onConnected(hostId: string): void;
  onDisconnected(): void;
  onError(err: Error): void;
}

/**
 * WebSocket client for the UCP phone↔bridge channel.
 *
 * Responsibilities:
 * - Open/close the native WebSocket.
 * - Send UCP command envelopes.
 * - Parse inbound JSON frames and dispatch via callbacks.
 * - Exponential-backoff reconnect on unintentional close.
 */
export class UcpClient {
  private url: string;
  private callbacks: UcpClientCallbacks;
  private ws: WebSocket | null = null;
  private status: UcpClientStatus = "idle";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private deviceId: string;
  private appVersion: string;
  private hostId: string | null = null;

  constructor(
    url: string,
    callbacks: UcpClientCallbacks,
    opts: { deviceId?: string; appVersion?: string } = {}
  ) {
    this.url = url;
    this.callbacks = callbacks;
    this.deviceId = opts.deviceId ?? this.generateId("dev");
    this.appVersion = opts.appVersion ?? "0.1.0";
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  connect(): void {
    if (this.status === "connected" || this.status === "connecting") return;
    this.intentionalClose = false;
    this.openSocket();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.closeSocket();
    this.status = "closed";
  }

  /**
   * Send a UCP command envelope.
   * Throws if not connected — callers should gate on connection status.
   */
  send(type: string, payload: unknown): void {
    if (this.ws === null || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`UcpClient: cannot send '${type}' — not connected`);
    }
    const envelope = {
      protocol: "ucp",
      version: 1,
      messageId: this.generateId("msg"),
      type,
      timestamp: new Date().toISOString(),
      hostId: this.hostId ?? "",
      payload,
    };
    this.ws.send(JSON.stringify(envelope));
  }

  getStatus(): UcpClientStatus {
    return this.status;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private openSocket(): void {
    this.status = this.reconnectAttempts > 0 ? "reconnecting" : "connecting";
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.status = "connected";
      this.reconnectAttempts = 0;
      // Send UCP initialization handshake
      const initMsg = {
        protocol: "ucp",
        version: 1,
        messageId: this.generateId("msg"),
        type: "connection.initialize",
        timestamp: new Date().toISOString(),
        payload: {
          supportedVersions: [1],
          deviceId: this.deviceId,
          deviceName: "Mobile",
          platform: "unknown",
          appVersion: this.appVersion,
          lastAcknowledgedSequence: 0,
          capabilities: {
            voice: false,
            binaryAudio: false,
            biometrics: false,
            pushNotifications: false,
          },
        },
      };
      ws.send(JSON.stringify(initMsg));
    };

    ws.onmessage = (evt: MessageEvent) => {
      this.handleFrame(evt.data as string);
    };

    ws.onclose = () => {
      this.ws = null;
      if (this.intentionalClose) return;
      this.callbacks.onDisconnected();
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onerror is always followed by onclose; report the error but let onclose drive reconnect.
      this.callbacks.onError(new Error("WebSocket error"));
    };
  }

  private handleFrame(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Malformed frame — ignore per UCP §17
      return;
    }

    const type = msg["type"];
    if (typeof type !== "string") return;

    // Handle the handshake response
    if (type === "connection.initialized") {
      const p = msg["payload"] as Record<string, unknown> | undefined;
      const hostId = typeof p?.["hostId"] === "string" ? p["hostId"] : "unknown";
      this.hostId = hostId;
      this.callbacks.onConnected(hostId);
      return;
    }

    // Dispatch as a UcpEvent
    const payload = (msg["payload"] ?? {}) as Record<string, unknown>;
    const event = { type, payload } as UcpEvent;
    this.callbacks.onEvent(event);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.status = "closed";
      this.callbacks.onError(new Error("Max reconnect attempts exceeded"));
      return;
    }
    this.reconnectAttempts += 1;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delayMs = BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    this.reconnectTimer = setTimeout(() => {
      this.openSocket();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocket(): void {
    if (this.ws !== null) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private generateId(prefix: string): string {
    // crypto.randomUUID() is available in React Native's Hermes ≥ 0.71
    const uuid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    return `${prefix}_${uuid}`;
  }
}
