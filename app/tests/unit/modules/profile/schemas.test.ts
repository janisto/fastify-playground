import Value from "typebox/value";
import { describe, expect, it } from "vitest";
import {
  normalizeContactEmail,
  normalizePhoneNumber,
  ProfileCreateSchema,
  ProfileSchema,
} from "../../../../src/modules/profile/schemas.js";

describe("profile canonicalization", () => {
  it("strips the complete ASCII edge-whitespace set but preserves internal input", () => {
    expect(normalizeContactEmail("\n\vAda@EXAMPLE.COM\f\r")).toBe("Ada@example.com");
    expect(normalizePhoneNumber("\t+358401234567 \n")).toBe("+358401234567");
    expect(normalizePhoneNumber("+358401234567")).toBe("+358401234567");
  });

  it("does not invent a domain for malformed input before schema validation", () => {
    expect(normalizeContactEmail("  invalid  ")).toBe("invalid");
  });

  it("models normalized wire input separately from canonical stored output", () => {
    const input = {
      firstName: "Ada",
      lastName: "Lovelace",
      contactEmail: "\tAda@EXAMPLE.COM \r",
      phoneNumber: "\n+358401234567 ",
      termsAccepted: true,
    };
    const profile = {
      id: "principal",
      ...input,
      contactEmail: "Ada@example.com",
      phoneNumber: "+358401234567",
      marketingOptIn: false,
      createdAt: "2026-07-30T12:00:00.000Z",
      updatedAt: "2026-07-30T12:00:00.000Z",
    };

    expect(Value.Check(ProfileCreateSchema, input)).toBe(true);
    expect(Value.Check(ProfileCreateSchema, { ...input, contactEmail: `${" ".repeat(300)}Ada@EXAMPLE.COM` })).toBe(
      true,
    );
    expect(
      Value.Check(ProfileCreateSchema, {
        ...input,
        contactEmail: `Ada@${Array.from({ length: 4 }, () => "a".repeat(63)).join(".")}`,
      }),
    ).toBe(false);
    expect(Value.Check(ProfileSchema, profile)).toBe(true);
    expect(Value.Check(ProfileSchema, { ...profile, contactEmail: "Ada@EXAMPLE.COM" })).toBe(false);
  });
});
