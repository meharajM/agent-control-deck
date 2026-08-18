import { describe, expect, it } from "vitest";
import { isValidPairingCode, normalizePairingCode } from "../services/pairing";

describe("pairing code", () => {
  it("normalizes user input to four digits", () => {
    expect(normalizePairingCode("a 1-2x3456")).toBe("1234");
    expect(isValidPairingCode("1234")).toBe(true);
  });

  it("rejects values that are not exactly four digits", () => {
    expect(isValidPairingCode("123")).toBe(false);
    expect(isValidPairingCode("12345")).toBe(false);
    expect(isValidPairingCode("12a4")).toBe(false);
  });
});
