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
    it("creates error with correct properties", () => {
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
    it("builds location for body context", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be string", "/name")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors.at(0)?.location).toBe("body.name");
    });

    it("builds location for querystring context", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be integer", "/limit")];

      const result = schemaErrorFormatter(errors, "querystring");

      expect(result.formattedErrors.at(0)?.location).toBe("query.limit");
    });

    it("builds location for params context", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be uuid", "/id")];

      const result = schemaErrorFormatter(errors, "params");

      expect(result.formattedErrors.at(0)?.location).toBe("path.id");
    });

    it("builds location for headers context", () => {
      const errors: FastifySchemaValidationError[] = [createError("is required", "/authorization")];

      const result = schemaErrorFormatter(errors, "headers");

      expect(result.formattedErrors.at(0)?.location).toBe("headers.authorization");
    });

    it("uses dataVar as prefix for unknown context", () => {
      const errors: FastifySchemaValidationError[] = [createError("validation failed", "/field")];

      const result = schemaErrorFormatter(errors, "custom");

      expect(result.formattedErrors.at(0)?.location).toBe("custom.field");
    });

    it("handles nested paths", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be string", "/user/address/street")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors.at(0)?.location).toBe("body.user.address.street");
    });

    it("handles empty instancePath", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be object", "")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors.at(0)?.location).toBe("body");
    });

    it("handles undefined instancePath", () => {
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

      expect(result.formattedErrors.at(0)?.location).toBe("query");
    });
  });

  describe("message building", () => {
    it("uses error message when available", () => {
      const errors: FastifySchemaValidationError[] = [createError("must be a valid email", "/email")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors.at(0)?.message).toBe("must be a valid email");
    });

    it("uses fallback message when message is empty", () => {
      const errors: FastifySchemaValidationError[] = [createError("", "/field")];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors.at(0)?.message).toBe("validation failed");
    });

    it("uses fallback message when message is undefined", () => {
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

      expect(result.formattedErrors.at(0)?.message).toBe("validation failed");
    });
  });

  describe("deduplication", () => {
    it("deduplicates errors with same location and message", () => {
      const errors: FastifySchemaValidationError[] = [
        createError("must be string", "/name"),
        createError("must be string", "/name"),
      ];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors).toHaveLength(1);
      expect(result.formattedErrors.at(0)).toEqual({
        message: "must be string",
        location: "body.name",
      });
    });

    it("keeps errors with different locations", () => {
      const errors: FastifySchemaValidationError[] = [
        createError("must be string", "/name"),
        createError("must be string", "/email"),
      ];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors).toHaveLength(2);
    });

    it("keeps errors with different messages at same location", () => {
      const errors: FastifySchemaValidationError[] = [
        createError("must be string", "/name"),
        createError("must match pattern", "/name"),
      ];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors).toHaveLength(2);
    });

    it("does not conflate location-message pairs containing colons", () => {
      const errors: FastifySchemaValidationError[] = [
        createError("detail:must match", "/field"),
        createError("must match", "/field:detail"),
      ];

      const result = schemaErrorFormatter(errors, "body");

      expect(result.formattedErrors).toEqual([
        { message: "detail:must match", location: "body.field" },
        { message: "must match", location: "body.field:detail" },
      ]);
    });
  });

  describe("multiple errors", () => {
    it("formats multiple errors from different fields", () => {
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
