import { describe, expect, it } from "vitest";
import { UcpCapabilitiesSchema } from "../validate.js";
import { validCapabilities } from "../fixtures/valid-capabilities.fixture.js";

describe("UcpCapabilitiesSchema", () => {
  it("accepts all-false capabilities", () => {
    const result = UcpCapabilitiesSchema.safeParse(validCapabilities);
    expect(result.success).toBe(true);
  });

  it("accepts capabilities with effortLevels", () => {
    const result = UcpCapabilitiesSchema.safeParse({
      ...validCapabilities,
      effortLevels: ["low", "medium", "high"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing send", () => {
    const { send: _s, ...rest } = validCapabilities;
    const result = UcpCapabilitiesSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing approvals object", () => {
    const { approvals: _a, ...rest } = validCapabilities;
    const result = UcpCapabilitiesSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects approvals missing a required field", () => {
    const { command: _c, ...approvalsWithout } = validCapabilities.approvals;
    const result = UcpCapabilitiesSchema.safeParse({
      ...validCapabilities,
      approvals: approvalsWithout,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra field on top-level (strict)", () => {
    const result = UcpCapabilitiesSchema.safeParse({ ...validCapabilities, rogue: true });
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra field on approvals (strict)", () => {
    const result = UcpCapabilitiesSchema.safeParse({
      ...validCapabilities,
      approvals: { ...validCapabilities.approvals, rogue: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean for send", () => {
    const result = UcpCapabilitiesSchema.safeParse({ ...validCapabilities, send: "yes" });
    expect(result.success).toBe(false);
  });

  it("rejects missing questions object", () => {
    const { questions: _q, ...rest } = validCapabilities;
    const result = UcpCapabilitiesSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing previews object", () => {
    const { previews: _p, ...rest } = validCapabilities;
    const result = UcpCapabilitiesSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
