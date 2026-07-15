import Value from "typebox/value";
import { describe, expect, it } from "vitest";
import { PaginationQuerySchema } from "../../../src/schemas/index.js";

describe("Shared TypeBox Schemas", () => {
  describe("PaginationQuerySchema", () => {
    it("accepts valid pagination query", () => {
      const query = { cursor: "abc123", limit: 50 };
      const result = Value.Check(PaginationQuerySchema, query);

      expect(result).toBe(true);
    });

    it("accepts empty object with defaults", () => {
      const query = {};
      const result = Value.Check(PaginationQuerySchema, query);

      expect(result).toBe(true);
    });

    it("rejects limit below minimum", () => {
      const query = { limit: 0 };
      const result = Value.Check(PaginationQuerySchema, query);

      expect(result).toBe(false);
    });

    it("rejects limit above maximum", () => {
      const query = { limit: 101 };
      const result = Value.Check(PaginationQuerySchema, query);

      expect(result).toBe(false);
    });
  });
});
