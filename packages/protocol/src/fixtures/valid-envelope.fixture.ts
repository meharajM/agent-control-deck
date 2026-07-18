import type { UcpEnvelope } from "../envelope.js";
import { asHostId, asMessageId, asTimestamp } from "../types.js";

/** Minimal valid UcpEnvelope for tests and contract verification. */
export const validEnvelope: UcpEnvelope = {
  protocol: "ucp",
  version: 1,
  messageId: asMessageId("msg-00000001"),
  type: "event/session_updated",
  timestamp: asTimestamp("2026-07-19T00:00:00.000Z"),
  hostId: asHostId("host-00000001"),
  payload: {},
};
