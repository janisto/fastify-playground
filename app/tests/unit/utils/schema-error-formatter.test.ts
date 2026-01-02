import type { FastifySchemaValidationError } from "fastify/types/schema.js";
import { describe, expect, it } from "vitest";
import { schemaErrorFormatter } from "../../../src/utils/schema-error-formatter.js";

function createError(message: string, instancePath: string): FastifySchemaValidationError {
  return {
    message,
    instancePath,
    keyword: "type",
    schemaPath: "#/properties/field/type",
    params: {},
  };
}

describe("schemaErrorFormatter", () => {
  describe("error object creation", () => {
    it("should create error with correct properties", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be string", "/name")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("validation failed");
      expect(result.statusCode).toBe(422);
      expect(result.code).toBe("FST_ERR_VALIDATION");
      expect(result.validation).toBe(errors);
      expect(result.validationContext).toBe("body");
      expect(result.formattedErrors).toHaveLength(1);
    });
  });

  describe("location building", () => {
    it("should build location for body context", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be string", "/name")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors[0].location).toBe("body.name");
    });

    it("should build location for querystring context", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be integer", "/limit")];

      const result = schemaErrorFormatter(errors, "querystring");

      expect(result.formattedErrors[0].location).toBe("query.limit");
    });

    it("should build location for params context", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be uuid", "/id")];

      const result = schemaErrorFormatter(errors, "params");

      expect(result.formattedErrors[0].location).toBe("path.id");
    });

    it("should build location for headers context", () => {
      const errors: FastifySchemaValidationError[] = [createError("is required", "/authorization")];

      const result = schemaErrorFormatter(errors, "headers");

      expect(result.formattedErrors[0].location).toBe("headers.authorization");
    });

    it("should use dataVar as prefix for unknown context", () => {
      const errors: FastifySchemaValidationError[] = [createError("validation failed", "/field")];

      const result = schemaErrorFormatter(errors, "custom");

      expect(result.formattedErrors[0].location).toBe("custom.field");
    });

    it("should handle nested paths", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be string", "/user/address/street")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors[0].location).toBe("body.user.address.street");
    });

    it("should handle empty instancePath", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be object", "")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors[0].location).toBe("body");
    });

    it("should handle undefined instancePath", () => {
      const errors = [
        {
          message: "must be object",
          instancePath: undefined,
          keyword: "type",
          schemaPath: "#/type",
          params: {},
        },
      ] as unknown as FastifySchemaValidationError[];

      const result = schemaErrorFormatter(errors, "querystring");

      expect(result.formattedErrors[0].location).toBe("query");
    });
  });

  describe("message building", () => {
    it("should use error message when available", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be a valid email", "/email")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors[0].message).toBe("must be a valid email");
    });

    it("should use fallback message when message is empty", () => {
      const errors: FastifySchemaValidationError[] = [createError("", "/field")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors[0].message).toBe("validation failed");
    });

    it("should use fallback message when message is undefined", () => {
      const errors = [
        {
          message: undefined,
          instancePath: "/field",
          keyword: "type",
          schemaPath: "#/type",
          params: {},
        },
      ] as unknown as FastifySchemaValidationError[];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors[0].message).toBe("validation failed");
    });
  });

  describe("deduplication", () => {
    it("should deduplicate errors with same location and message", () => {
      const errors: FastifySchemaValidationError[] = [
        createError("must be string", "/name"),
        createError("must be string", "/name"),
      ];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors).toHaveLength(1);
      expect(result.formattedErrors[0]).toEqual({
        message: "must be string",
        location: "body.name",
      });
    });

    it("should keep errors with different locations", () => {
      const errors: FastifySchemaValidationError[] = [
        createError("must be string", "/name"),
        createError("must be string", "/email"),
      ];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors).toHaveLength(2);
    });

    it("should keep errors with different messages at same location", () => {
      const errors: FastifySchemaValidationError[] = [
        createError("must be string", "/name"),
        createError("must match pattern", "/name"),
      ];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors).toHaveLength(2);
    });
  });

  describe("multiple errors", () => {
    it("should format multiple errors from different fields", () => {
      const errors: FastifySchemaValidationError[] = [
        createError("is required", "/name"),
        createError("must be integer", "/age"),
        createError("must be valid email", "/email"),
      ];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors).toHaveLength(3);
      expect(result.formattedErrors).toEqual([
        { message: "is required", location: "body.name" },
        { message: "must be integer", location: "body.age" },
        { message: "must be valid email", location: "body.email" },
      ]);
    });
  });
});
