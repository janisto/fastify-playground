import { describe, expect, it } from "vitest";
import { buildLinkHeader, decodeCursor, encodeCursor } from "../../../src/utils/pagination.js";

describe("Pagination Utilities", () => {
  describe("encodeCursor / decodeCursor roundtrip", () => {
    it("should encode and decode a cursor correctly", () => {
      const cursor = { type: "id", value: "abc123" };
      const encoded = encodeCursor(cursor);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });

    it("should handle special characters in value", () => {
      const cursor = { type: "timestamp", value: "2026-01-02T14:30:00.000Z" };
      const encoded = encodeCursor(cursor);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });

    it("should handle empty type", () => {
      const cursor = { type: "", value: "some-value" };
      const encoded = encodeCursor(cursor);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });

    it("should handle value containing colons", () => {
      const cursor = { type: "key", value: "foo:bar:baz" };
      const encoded = encodeCursor(cursor);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });
  });

  describe("decodeCursor", () => {
    it("should return default cursor for undefined input", () => {
      const result = decodeCursor(undefined);

      expect(result).toEqual({ type: "", value: "" });
    });

    it("should return null for invalid base64 that decodes to non-cursor format", () => {
      const invalidCursor = Buffer.from("nocolonhere").toString("base64url");
      const result = decodeCursor(invalidCursor);

      expect(result).toBeNull();
    });

    it("should return null for invalid base64url string", () => {
      const result = decodeCursor("!!!invalid-base64!!!");

      expect(result).toBeNull();
    });
  });

  describe("buildLinkHeader", () => {
    it("should build Link header with next cursor only", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ limit: "10" });
      const result = buildLinkHeader(baseUrl, query, "next-cursor-value");

      expect(result).toBe('<https://api.example.com/items?cursor=next-cursor-value&limit=10>; rel="next"');
    });

    it("should build Link header with prev cursor only", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ limit: "10" });
      const result = buildLinkHeader(baseUrl, query, undefined, "prev-cursor-value");

      expect(result).toBe('<https://api.example.com/items?cursor=prev-cursor-value&limit=10>; rel="prev"');
    });

    it("should build Link header with both next and prev cursors", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ limit: "10" });
      const result = buildLinkHeader(baseUrl, query, "next-cursor", "prev-cursor");

      expect(result).toContain('rel="next"');
      expect(result).toContain('rel="prev"');
      expect(result).toContain("cursor=next-cursor");
      expect(result).toContain("cursor=prev-cursor");
    });

    it("should return empty string when no cursors provided", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ limit: "10" });
      const result = buildLinkHeader(baseUrl, query);

      expect(result).toBe("");
    });

    it("should preserve existing query parameters", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ filter: "active", sort: "name" });
      const result = buildLinkHeader(baseUrl, query, "next-cursor");

      expect(result).toContain("filter=active");
      expect(result).toContain("sort=name");
      expect(result).toContain("cursor=next-cursor");
    });

    it("should override existing cursor in query params for next", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ cursor: "old-cursor", limit: "10" });
      const result = buildLinkHeader(baseUrl, query, "new-cursor");

      expect(result).toContain("cursor=new-cursor");
      expect(result).not.toContain("cursor=old-cursor");
    });

    it("should override existing cursor in query params for prev", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ cursor: "old-cursor", limit: "10" });
      const result = buildLinkHeader(baseUrl, query, undefined, "prev-cursor");

      expect(result).toContain("cursor=prev-cursor");
      expect(result).not.toContain("cursor=old-cursor");
      expect(result).toContain("limit=10");
    });
  });
});
