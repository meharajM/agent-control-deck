import type { CorrelationId, HostId, MessageId, SessionId, Timestamp } from "./types.js";

/**
 * UCP wire envelope — derived from schemas/ucp-envelope.schema.json.
 * Every message crossing the phone↔bridge transport is wrapped in this shape.
 */
export interface UcpEnvelope {
  /** Literal discriminant — always "ucp". */
  readonly protocol: "ucp";
  /** Protocol version integer, minimum 1. */
  readonly version: number;
  /** Unique message identifier (8–128 chars). */
  readonly messageId: MessageId;
  /** Message type string (8–128 chars), e.g. "command/send" or "event/session_updated". */
  readonly type: string;
  /** Monotonic host-assigned sequence number (optional). */
  readonly sequence?: number;
  /** ISO-8601 timestamp. */
  readonly timestamp: Timestamp;
  /** Identifies the bridge host that produced or routed the message. */
  readonly hostId: HostId;
  /** Optional session scope for this message. */
  readonly sessionId?: SessionId;
  /** Links a response back to a request. */
  readonly correlationId?: CorrelationId;
  /** Typed payload — concrete shape depends on `type`. */
  readonly payload: Record<string, unknown>;
}
