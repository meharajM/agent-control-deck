import { describe, expect, it } from "vitest";
import { UcpEnvelopeSchema } from "../validate.js";
import { validEnvelope } from "../fixtures/valid-envelope.fixture.js";

describe("UcpEnvelopeSchema", () => {
  it("accepts a valid envelope", () => {
    const result = UcpEnvelopeSchema.safeParse(validEnvelope);
    expect(result.success).toBe(true);
  });

  it("accepts envelope with optional fields", () => {
    const result = UcpEnvelopeSchema.safeParse({
      ...validEnvelope,
      sequence: 42,
      sessionId: "sess-00000001",
      correlationId: "corr-00000001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing protocol", () => {
    const { protocol: _p, ...rest } = validEnvelope;
    const result = UcpEnvelopeSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects wrong protocol literal", () => {
    const result = UcpEnvelopeSchema.safeParse({ ...validEnvelope, protocol: "other" });
    expect(result.success).toBe(false);
  });

  it("rejects missing messageId", () => {
    const { messageId: _m, ...rest } = validEnvelope;
    const result = UcpEnvelopeSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects messageId shorter than 8 chars", () => {
    const result = UcpEnvelopeSchema.safeParse({ ...validEnvelope, messageId: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects missing timestamp", () => {
    const { timestamp: _t, ...rest } = validEnvelope;
    const result = UcpEnvelopeSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid timestamp format", () => {
    const result = UcpEnvelopeSchema.safeParse({ ...validEnvelope, timestamp: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects missing hostId", () => {
    const { hostId: _h, ...rest } = validEnvelope;
    const result = UcpEnvelopeSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra fields (strict)", () => {
    const result = UcpEnvelopeSchema.safeParse({ ...validEnvelope, rogue: true });
    expect(result.success).toBe(false);
  });

  it("rejects version below minimum", () => {
    const result = UcpEnvelopeSchema.safeParse({ ...validEnvelope, version: 0 });
    expect(result.success).toBe(false);
  });
});
