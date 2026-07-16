import { describe, expect, it } from "vitest";
import { buildLinkHeader, decodeCursor, encodeCursor } from "../../../src/utils/pagination.js";

describe("pagination utilities", () => {
  describe("cursor codec", () => {
    it("round-trips an application cursor", () => {
      const cursor = { type: "id", value: "abc123" };
      const encoded = encodeCursor(cursor);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });

    it("preserves colons in the cursor value", () => {
      const cursor = { type: "timestamp", value: "2026-01-02T14:30:00.000Z" };
      const encoded = encodeCursor(cursor);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursor);
    });

    it("uses an empty sentinel only when the query parameter is absent", () => {
      const result = decodeCursor(undefined);

      expect(result).toEqual({ type: "", value: "" });
    });

    it.each([
      ["empty input", ""],
      ["invalid alphabet", "!!!invalid-base64!!!"],
      ["invalid encoded length", "a"],
      ["noncanonical padding", "aWQ6MQ=="],
      ["missing separator", Buffer.from("nocolonhere").toString("base64url")],
      ["empty type", Buffer.from(":value").toString("base64url")],
      ["empty value", Buffer.from("type:").toString("base64url")],
      ["invalid UTF-8", Buffer.from([0xff]).toString("base64url")],
      ["oversized cursor", "a".repeat(2049)],
    ])("rejects %s", (_case, encoded) => {
      expect(decodeCursor(encoded)).toBeNull();
    });
  });

  describe("buildLinkHeader", () => {
    it("builds a next link and preserves non-cursor query parameters", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ limit: "10", category: "tools" });
      const result = buildLinkHeader(baseUrl, query, "next-cursor-value");

      expect(result).toBe(
        '<https://api.example.com/items?cursor=next-cursor-value&limit=10&category=tools>; rel="next"',
      );
    });

    it("builds a previous link from an opaque cursor", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ limit: "10" });
      const result = buildLinkHeader(baseUrl, query, undefined, "prev-cursor-value");

      expect(result).toBe('<https://api.example.com/items?cursor=prev-cursor-value&limit=10>; rel="prev"');
    });

    it("builds both directional links", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ limit: "10" });
      const result = buildLinkHeader(baseUrl, query, "next-cursor", "prev-cursor");

      expect(result).toContain('rel="next"');
      expect(result).toContain('rel="prev"');
      expect(result).toContain("cursor=next-cursor");
      expect(result).toContain("cursor=prev-cursor");
    });

    it("links the second page back to the first page without an empty cursor", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ limit: "10" });
      const result = buildLinkHeader(baseUrl, query, undefined, null);

      expect(result).toBe('<https://api.example.com/items?limit=10>; rel="prev"');
    });

    it("returns no links at a single-page boundary", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ limit: "10" });
      const result = buildLinkHeader(baseUrl, query);

      expect(result).toBe("");
    });

    it("replaces the current cursor in both directional links", () => {
      const baseUrl = "https://api.example.com/items";
      const query = new URLSearchParams({ cursor: "old-cursor", limit: "10" });
      const result = buildLinkHeader(baseUrl, query, "next-cursor", "prev-cursor");

      expect(result).toContain("cursor=next-cursor");
      expect(result).toContain("cursor=prev-cursor");
      expect(result).not.toContain("cursor=old-cursor");
      expect(result).toContain("limit=10");
    });
  });
});
