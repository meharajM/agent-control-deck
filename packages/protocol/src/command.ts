import type { CommandId, IdempotencyKey, Timestamp } from "./types.js";

/**
 * UCP state-changing command payload — derived from schemas/ucp-command.schema.json.
 * Embedded in UcpEnvelope.payload for any mutating command.
 *
 * additionalProperties: true in the schema — concrete command types extend this
 * with their own fields via intersection or extension.
 */
export interface UcpCommandPayload {
  /** Unique command identifier (8–128 chars). */
  readonly commandId: CommandId;
  /** Client-supplied idempotency key (8–128 chars). Safe to retry. */
  readonly idempotencyKey: IdempotencyKey;
  /** Optimistic concurrency: expected session version. */
  readonly expectedSessionVersion?: number;
  /** Optimistic concurrency: expected approval version. */
  readonly expectedApprovalVersion?: number;
  /** ISO-8601 time the command was issued by the client. */
  readonly issuedAt?: Timestamp;
  /** Extension fields permitted by the open schema. */
  readonly [key: string]: unknown;
}
