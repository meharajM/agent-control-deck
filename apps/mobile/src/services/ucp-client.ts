import type { UcpEvent } from "../types";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

export type UcpClientStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

export interface UcpClientCallbacks {
  onEvent(event: UcpEvent): void;
  onConnected(hostId: string, hostName?: string): void;
  onDisconnected(): void;
  onError(err: Error): void;
}

/**
 * Crypto interface abstracted away from the main client.
 * Allows the client to work without crypto in tests, while real usage
 * injects the crypto functions from @agent-deck/crypto.
 */
export interface UcpClientCrypto {
  generateKeyPair(): Promise<{ publicKeyBase64: string; privateKeyBase64: string }>;
  deriveSessionKey(
    privateKeyBase64: string,
    peerPublicKeyBase64: string,
  ): { sessionKeyBase64: string };
  encryptFrame(
    envelope: Record<string, unknown>,
    sessionKeyBase64: string,
    sequence: number,
  ): { encrypted: true; sequence: number; nonce: string; ciphertext: string };
  decryptFrame(
    frame: { ciphertext: string },
    sessionKeyBase64: string,
  ): Record<string, unknown>;
}

export interface UcpClientOpts {
  deviceId?: string;
  appVersion?: string;
  crypto?: UcpClientCrypto;
  hostPublicKey?: string;
  pairingNonce?: string;
  pairingCode?: string;
  requestHostPublicKey?: boolean;
  getLastSyncSequence?: () => number;
}

/**
 * WebSocket client for the UCP phone-to-bridge channel.
 *
 * Supports encrypted transport via optional crypto parameter.
 * When crypto is provided, handshake includes device public key
 * and all subsequent frames are encrypted.
 */
export class UcpClient {
  private url: string;
  private callbacks: UcpClientCallbacks;
  // ponytail: typed as any to avoid undici-types vs RN WebSocket conflict
  private ws: any = null;
  private status: UcpClientStatus = "idle";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private deviceId: string;
  private appVersion: string;
  private hostId: string | null = null;
  private crypto: UcpClientCrypto | null = null;
  private privateKeyBase64: string | null = null;
  private publicKeyBase64: string | null = null;
  private sessionKeyBase64: string | null = null;
  private outboundSequence = 0;
  private pairingNonce: string | null = null;
  private pairingCode: string | null = null;
  private requestHostPublicKey: boolean;
  private getLastSyncSequence: () => number;

  constructor(
    url: string,
    callbacks: UcpClientCallbacks,
    opts: UcpClientOpts = {},
  ) {
    this.url = url;
    this.callbacks = callbacks;
    this.deviceId = opts.deviceId ?? this.generateId("dev");
    this.appVersion = opts.appVersion ?? "0.1.0";
    this.crypto = opts.crypto ?? null;
    // ponytail: hostPublicKey is passed in opts; production would load from secure store
    if (opts.hostPublicKey) {
      this._hostPublicKey = opts.hostPublicKey;
    }
    this.pairingNonce = opts.pairingNonce ?? null;
    this.pairingCode = opts.pairingCode ?? null;
    this.requestHostPublicKey = opts.requestHostPublicKey ?? false;
    this.getLastSyncSequence = opts.getLastSyncSequence ?? (() => 0);
  }

  private _hostPublicKey: string | null = null;

  /**
   * Set the host public key for session key derivation.
   * Called after the pairing code supplies the host public key.
   */
  setHostPublicKey(key: string): void {
    this._hostPublicKey = key;
  }

  /**
   * Set or load the device key pair.
   */
  setDeviceKeys(publicKeyBase64: string, privateKeyBase64: string): void {
    this.publicKeyBase64 = publicKeyBase64;
    this.privateKeyBase64 = privateKeyBase64;
  }

  /**
   * Get the device public key for pairing / registration.
   */
  getDevicePublicKey(): string | null {
    return this.publicKeyBase64;
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
   * When crypto is available and session key is established, frames are encrypted.
   */
  send(type: string, payload: unknown): void {
    if (this.ws === null || this.ws.readyState !== 1) {
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

    if (this.crypto && this.sessionKeyBase64) {
      this.outboundSequence += 1;
      const frame = this.crypto.encryptFrame(
        envelope,
        this.sessionKeyBase64,
        this.outboundSequence,
      );
      this.ws.send(JSON.stringify(frame));
    } else {
      this.ws.send(JSON.stringify(envelope));
    }
  }

  getStatus(): UcpClientStatus {
    return this.status;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private ensureDeviceKeysSync(): void {
    if (this.crypto && !this.publicKeyBase64) {
      // ponytail: key gen is sync in test mocks; production crypto injects sync helper
      // The UcpClientCrypto interface is designed for sync usage after initial setup
      const keys = (this.crypto as any).generateKeyPairSync?.();
      if (keys) {
        this.publicKeyBase64 = keys.publicKeyBase64;
        this.privateKeyBase64 = keys.privateKeyBase64;
      }
    }
  }

  private openSocket(): void {
    this.status = this.reconnectAttempts > 0 ? "reconnecting" : "connecting";
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.status = "connected";
      this.reconnectAttempts = 0;

      void this.sendHandshake(ws).catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        this.callbacks.onError(err);
        if (ws !== this.ws) return;
        this.intentionalClose = true;
        this.status = "closed";
        this.closeSocket();
        this.callbacks.onDisconnected();
      });
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
      this.callbacks.onError(new Error("WebSocket error"));
    };
  }

  private async sendHandshake(ws: any): Promise<void> {
    if (this.crypto && !this.publicKeyBase64) {
      const keys = await this.crypto.generateKeyPair();
      this.publicKeyBase64 = keys.publicKeyBase64;
      this.privateKeyBase64 = keys.privateKeyBase64;
    }

    // The bridge encrypts connection.initialized immediately after accepting
    // the handshake. Derive before sending so that first encrypted response
    // can be opened; waiting for that response would be a circular handshake.
    if (this.crypto && this.privateKeyBase64 && this._hostPublicKey) {
      const { sessionKeyBase64 } = this.crypto.deriveSessionKey(
        this.privateKeyBase64,
        this._hostPublicKey,
      );
      this.sessionKeyBase64 = sessionKeyBase64;
    }

      // Build handshake payload — include device public key when crypto is available
      const handshakePayload: Record<string, unknown> = {
        supportedVersions: [1],
        deviceId: this.deviceId,
        deviceName: "Mobile",
        platform: "unknown",
        appVersion: this.appVersion,
        lastSyncSequence: this.getLastSyncSequence(),
        capabilities: {
          voice: false,
          binaryAudio: false,
          biometrics: false,
          pushNotifications: false,
        },
      };

      if (this.pairingNonce) {
        handshakePayload.pairingNonce = this.pairingNonce;
      }
      if (this.pairingCode) {
        handshakePayload.pairingCode = this.pairingCode;
      }
      if (this.requestHostPublicKey) {
        handshakePayload.requestHostPublicKey = true;
      }

      if (this.crypto && this.publicKeyBase64) {
        handshakePayload.devicePublicKey = this.publicKeyBase64;
      }

      const initMsg = {
        protocol: "ucp",
        version: 1,
        messageId: this.generateId("msg"),
        type: "connection.initialize",
        timestamp: new Date().toISOString(),
        payload: handshakePayload,
      };
      if (ws === this.ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(initMsg));
  }

  private handleFrame(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = msg["type"];

    // Handle encrypted frame
    if (this.crypto && msg["encrypted"] === true && this.sessionKeyBase64) {
      try {
        const decrypted = this.crypto.decryptFrame(
          msg as { ciphertext: string },
          this.sessionKeyBase64,
        );
        this.handleDecryptedFrame(decrypted);
      } catch {
        // Tampered frame — ignore
      }
      return;
    }

    if (typeof type !== "string") return;
    this.handleDecryptedFrame(msg);
  }

  private handleDecryptedFrame(msg: Record<string, unknown>): void {
    const type = msg["type"];
    if (typeof type !== "string") return;

    // Handle the handshake response — derive session key
    if (type === "connection.initialized") {
      const p = msg["payload"] as Record<string, unknown> | undefined;
      const hostId = typeof p?.["hostId"] === "string" ? p["hostId"] : "unknown";
      const hostName =
        typeof p?.["hostName"] === "string" && p["hostName"].trim().length > 0
          ? p["hostName"]
          : undefined;
      this.hostId = hostId;

      const negotiatedHostPublicKey =
        typeof p?.["hostPublicKey"] === "string" && p["hostPublicKey"].length > 0
          ? p["hostPublicKey"]
          : null;
      if (negotiatedHostPublicKey) {
        this.setHostPublicKey(negotiatedHostPublicKey);
      }

      // Derive session key if we have crypto and host public key
      if (this.crypto && this.privateKeyBase64 && this._hostPublicKey) {
        const { sessionKeyBase64 } = this.crypto.deriveSessionKey(
          this.privateKeyBase64,
          this._hostPublicKey,
        );
        this.sessionKeyBase64 = sessionKeyBase64;
      }

      this.callbacks.onConnected(hostId, hostName);
      return;
    }

    const payload = { ...((msg["payload"] ?? {}) as Record<string, unknown>) };
    const sessionId = msg["sessionId"];
    if (typeof sessionId === "string") {
      if (typeof payload.id !== "string") payload.id = sessionId;
      if (typeof payload.updatedAt !== "string" && typeof msg.timestamp === "string") {
        payload.updatedAt = msg.timestamp;
      }
      if (typeof payload.createdAt !== "string" && typeof msg.timestamp === "string") {
        payload.createdAt = msg.timestamp;
      }
    }
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
    const uuid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    return `${prefix}_${uuid}`;
  }
}
