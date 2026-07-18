import { z } from "zod";

// ── Shared primitives ────────────────────────────────────────────────────────

/** Reusable constraint: 8–128 char non-empty string. */
const id128 = z.string().min(8).max(128);

// ── Envelope ─────────────────────────────────────────────────────────────────

export const UcpEnvelopeSchema = z
  .object({
    protocol: z.literal("ucp"),
    version: z.number().int().min(1),
    messageId: id128,
    type: z.string().min(1).max(128),
    sequence: z.number().int().min(0).optional(),
    timestamp: z.string().datetime(),
    hostId: id128,
    sessionId: id128.optional(),
    correlationId: id128.optional(),
    payload: z.record(z.unknown()),
  })
  .strict();

export type UcpEnvelopeInput = z.input<typeof UcpEnvelopeSchema>;

// ── Command payload ───────────────────────────────────────────────────────────

export const UcpCommandPayloadSchema = z
  .object({
    commandId: id128,
    idempotencyKey: id128,
    expectedSessionVersion: z.number().int().min(0).optional(),
    expectedApprovalVersion: z.number().int().min(0).optional(),
    issuedAt: z.string().datetime().optional(),
  })
  // additionalProperties: true in schema
  .passthrough();

export type UcpCommandPayloadInput = z.input<typeof UcpCommandPayloadSchema>;

// ── Capabilities ─────────────────────────────────────────────────────────────

const UcpApprovalCapabilitiesSchema = z
  .object({
    command: z.boolean(),
    fileChange: z.boolean(),
    network: z.boolean(),
    filesystem: z.boolean(),
    genericTool: z.boolean(),
    approveForSession: z.boolean(),
    modifyBeforeApproval: z.boolean(),
  })
  .strict();

const UcpQuestionCapabilitiesSchema = z
  .object({
    singleChoice: z.boolean(),
    multiSelect: z.boolean(),
    freeText: z.boolean(),
  })
  .strict();

const UcpPreviewCapabilitiesSchema = z
  .object({
    diff: z.boolean(),
    tests: z.boolean(),
    commands: z.boolean(),
    files: z.boolean(),
    rawTranscript: z.boolean(),
  })
  .strict();

export const UcpCapabilitiesSchema = z
  .object({
    send: z.boolean(),
    steerInFlight: z.boolean(),
    cancel: z.boolean(),
    retry: z.boolean(),
    resume: z.boolean(),
    fork: z.boolean(),
    approvals: UcpApprovalCapabilitiesSchema,
    questions: UcpQuestionCapabilitiesSchema,
    previews: UcpPreviewCapabilitiesSchema,
    effortLevels: z.array(z.string()).optional(),
    skills: z.boolean(),
    macros: z.boolean(),
  })
  .strict();

export type UcpCapabilitiesInput = z.input<typeof UcpCapabilitiesSchema>;
