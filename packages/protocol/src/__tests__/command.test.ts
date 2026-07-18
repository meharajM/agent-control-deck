import { describe, expect, it } from "vitest";
import { UcpCommandPayloadSchema } from "../validate.js";
import { validCommand } from "../fixtures/valid-command.fixture.js";

describe("UcpCommandPayloadSchema", () => {
  it("accepts a valid command payload", () => {
    const result = UcpCommandPayloadSchema.safeParse(validCommand);
    expect(result.success).toBe(true);
  });

  it("accepts command with all optional fields", () => {
    const result = UcpCommandPayloadSchema.safeParse({
      ...validCommand,
      expectedSessionVersion: 3,
      expectedApprovalVersion: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts extra fields (open schema)", () => {
    const result = UcpCommandPayloadSchema.safeParse({
      ...validCommand,
      customField: "allowed",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing commandId", () => {
    const { commandId: _c, ...rest } = validCommand;
    const result = UcpCommandPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects commandId shorter than 8 chars", () => {
    const result = UcpCommandPayloadSchema.safeParse({ ...validCommand, commandId: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects missing idempotencyKey", () => {
    const { idempotencyKey: _k, ...rest } = validCommand;
    const result = UcpCommandPayloadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects idempotencyKey shorter than 8 chars", () => {
    const result = UcpCommandPayloadSchema.safeParse({ ...validCommand, idempotencyKey: "tiny" });
    expect(result.success).toBe(false);
  });

  it("rejects negative expectedSessionVersion", () => {
    const result = UcpCommandPayloadSchema.safeParse({
      ...validCommand,
      expectedSessionVersion: -1,
    });
    expect(result.success).toBe(false);
  });
});
