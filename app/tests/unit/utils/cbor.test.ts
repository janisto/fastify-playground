import { describe, expect, it } from "vitest";
import { isCborContentType, prefersCbor } from "../../../src/utils/cbor.js";

describe("CBOR utilities", () => {
  describe("prefersCbor", () => {
    it("should return false for undefined accept header", () => {
      expect(prefersCbor(undefined)).toBe(false);
    });

    it("should return false for JSON accept header", () => {
      expect(prefersCbor("application/json")).toBe(false);
    });

    it("should return true for application/cbor", () => {
      expect(prefersCbor("application/cbor")).toBe(true);
    });

    it("should return true for application/problem+cbor", () => {
      expect(prefersCbor("application/problem+cbor")).toBe(true);
    });

    it("should return true when cbor is in accept header with other types", () => {
      expect(prefersCbor("application/json, application/cbor")).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(prefersCbor("")).toBe(false);
    });
  });

  describe("isCborContentType", () => {
    it("should return false for undefined content type", () => {
      expect(isCborContentType(undefined)).toBe(false);
    });

    it("should return false for JSON content type", () => {
      expect(isCborContentType("application/json")).toBe(false);
    });

    it("should return true for application/cbor", () => {
      expect(isCborContentType("application/cbor")).toBe(true);
    });

    it("should return true for application/cbor with charset", () => {
      expect(isCborContentType("application/cbor; charset=utf-8")).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(isCborContentType("")).toBe(false);
    });
  });
});
