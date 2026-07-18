import type { UcpCommandPayload } from "../command.js";
import { asCommandId, asIdempotencyKey, asTimestamp } from "../types.js";

/** Minimal valid UcpCommandPayload for tests and contract verification. */
export const validCommand: UcpCommandPayload = {
  commandId: asCommandId("cmd-00000001"),
  idempotencyKey: asIdempotencyKey("idem-0000001"),
  issuedAt: asTimestamp("2026-07-19T00:00:00.000Z"),
};
