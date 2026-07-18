/**
 * Shared branded primitive types for UCP.
 * Branding catches accidental cross-assignment at compile time with zero runtime cost.
 */

declare const _brand: unique symbol;
type Brand<T, B> = T & { readonly [_brand]: B };

export type MessageId = Brand<string, "MessageId">;
export type HostId = Brand<string, "HostId">;
export type SessionId = Brand<string, "SessionId">;
export type CommandId = Brand<string, "CommandId">;
export type IdempotencyKey = Brand<string, "IdempotencyKey">;
export type CorrelationId = Brand<string, "CorrelationId">;
/** ISO-8601 date-time string */
export type Timestamp = Brand<string, "Timestamp">;

/** Cast helpers — call only after validating with Zod schemas. */
export const asMessageId = (s: string): MessageId => s as MessageId;
export const asHostId = (s: string): HostId => s as HostId;
export const asSessionId = (s: string): SessionId => s as SessionId;
export const asCommandId = (s: string): CommandId => s as CommandId;
export const asIdempotencyKey = (s: string): IdempotencyKey => s as IdempotencyKey;
export const asCorrelationId = (s: string): CorrelationId => s as CorrelationId;
export const asTimestamp = (s: string): Timestamp => s as Timestamp;
