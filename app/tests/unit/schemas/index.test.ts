import Value from "typebox/value";
import { describe, expect, it } from "vitest";
import {
  PaginationQuerySchema,
  ProblemDetailsSchema,
  TimestampSchema,
  ValidationProblemSchema,
} from "../../../src/schemas/index.js";

describe("Shared TypeBox Schemas", () => {
  describe("PaginationQuerySchema", () => {
    it("should accept valid pagination query", () => {
      const query = { cursor: "abc123", limit: 50 };
      const result = Value.Check(PaginationQuerySchema, query);

      expect(result).toBe(true);
    });

    it("should accept empty object with defaults", () => {
      const query = {};
      const result = Value.Check(PaginationQuerySchema, query);

      expect(result).toBe(true);
    });

    it("should reject limit below minimum", () => {
      const query = { limit: 0 };
      const result = Value.Check(PaginationQuerySchema, query);

      expect(result).toBe(false);
    });

    it("should reject limit above maximum", () => {
      const query = { limit: 101 };
      const result = Value.Check(PaginationQuerySchema, query);

      expect(result).toBe(false);
    });
  });

  describe("ProblemDetailsSchema", () => {
    it("should have correct $id", () => {
      expect((ProblemDetailsSchema as unknown as { $id: string }).$id).toBe("ProblemDetails");
    });

    it("should accept valid problem details", () => {
      const problem = {
        title: "Not Found",
        status: 404,
        detail: "The requested resource was not found",
        instance: "/api/items/123",
      };
      const result = Value.Check(ProblemDetailsSchema, problem);

      expect(result).toBe(true);
    });

    it("should require title and status", () => {
      const incomplete = { detail: "Some error" };
      const result = Value.Check(ProblemDetailsSchema, incomplete);

      expect(result).toBe(false);
    });

    it("should accept optional $schema field", () => {
      const problem = {
        $schema: "https://api.example.com/schemas/ProblemDetails.json",
        title: "Bad Request",
        status: 400,
      };
      const result = Value.Check(ProblemDetailsSchema, problem);

      expect(result).toBe(true);
    });
  });

  describe("ValidationProblemSchema", () => {
    it("should have correct $id", () => {
      expect((ValidationProblemSchema as unknown as { $id: string }).$id).toBe("ValidationProblem");
    });

    it("should accept valid validation problem with errors", () => {
      const validationProblem = {
        title: "Validation Failed",
        status: 422,
        errors: [
          { field: "email", message: "Invalid email format", pointer: "#/email" },
          { field: "age", message: "Must be a positive number" },
        ],
      };
      const result = Value.Check(ValidationProblemSchema, validationProblem);

      expect(result).toBe(true);
    });

    it("should require errors array", () => {
      const problem = {
        title: "Validation Failed",
        status: 422,
      };
      const result = Value.Check(ValidationProblemSchema, problem);

      expect(result).toBe(false);
    });
  });

  describe("TimestampSchema", () => {
    it("should have format date-time", () => {
      expect((TimestampSchema as unknown as { format: string }).format).toBe("date-time");
    });

    it("should have description", () => {
      expect((TimestampSchema as unknown as { description: string }).description).toBe("ISO 8601 timestamp in UTC");
    });

    it("should accept valid ISO 8601 timestamp", () => {
      const timestamp = "2026-01-02T14:30:00.000Z";
      const result = Value.Check(TimestampSchema, timestamp);

      expect(result).toBe(true);
    });

    it("should reject invalid date-time format", () => {
      const invalidTimestamp = "not-a-timestamp";
      const result = Value.Check(TimestampSchema, invalidTimestamp);

      expect(result).toBe(false);
    });
  });
});
