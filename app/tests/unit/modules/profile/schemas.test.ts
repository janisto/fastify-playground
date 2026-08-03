import { describe, expect, it } from "vitest";
import { normalizeContactEmail, normalizePhoneNumber } from "../../../../src/modules/profile/schemas.js";

describe("profile canonicalization", () => {
  it("strips the complete ASCII edge-whitespace set but preserves internal input", () => {
    expect(normalizeContactEmail("\n\vAda@EXAMPLE.COM\f\r")).toBe("Ada@example.com");
    expect(normalizePhoneNumber("\t+358401234567 \n")).toBe("+358401234567");
    expect(normalizePhoneNumber("+358401234567")).toBe("+358401234567");
  });

  it("does not invent a domain for malformed input before schema validation", () => {
    expect(normalizeContactEmail("  invalid  ")).toBe("invalid");
  });
});
