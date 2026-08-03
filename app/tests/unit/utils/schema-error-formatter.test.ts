import type { FastifySchemaValidationError } from "fastify/types/schema.js";
import { describe, expect, it } from "vitest";
import { schemaErrorFormatter } from "../../../src/utils/schema-error-formatter.js";

function validation(instancePath: string, message = "private rejected value canary"): FastifySchemaValidationError {
  return { instancePath, message, keyword: "type", schemaPath: "#/private", params: { value: "secret" } };
}

describe("schemaErrorFormatter", () => {
  it("creates a stable 422 error without exposing framework diagnostics", () => {
    const input = [validation("/displayName")];
    const result = schemaErrorFormatter(input, "body");

    expect(result).toMatchObject({
      message: "Request validation failed",
      statusCode: 422,
      code: "FST_ERR_VALIDATION",
      validation: input,
      validationContext: "body",
      formattedErrors: [{ detail: "Request validation failed", source: { pointer: "/displayName" } }],
    });
    expect(JSON.stringify(result.formattedErrors)).not.toContain("private rejected value canary");
    expect(JSON.stringify(result.formattedErrors)).not.toContain("secret");
  });

  it.each([
    ["querystring", "/limit", { parameter: "limit" }],
    ["params", "/owner", { parameter: "owner" }],
    ["headers", "/authorization", { header: "Authorization" }],
  ])("emits an allowlisted %s source", (context, path, source) => {
    expect(schemaErrorFormatter([validation(path)], context).formattedErrors).toEqual([
      { detail: "Request validation failed", source },
    ]);
  });

  it.each([
    ["body", "/unsafe~1pointer"],
    ["querystring", "/password"],
    ["headers", "/cookie"],
    ["custom", "/limit"],
  ])("omits an unsafe or unknown source for %s %s", (context, path) => {
    expect(schemaErrorFormatter([validation(path)], context).formattedErrors).toEqual([
      { detail: "Request validation failed" },
    ]);
  });

  it("deduplicates identical public issues and caps output at 32", () => {
    const errors = Array.from({ length: 40 }, (_, index) => validation(`/field${index}`));
    errors.unshift(validation("/field0"));
    const result = schemaErrorFormatter(errors, "body").formattedErrors;

    expect(result).toHaveLength(32);
    expect(result.at(-1)).toEqual({ detail: "Additional validation errors omitted" });
  });
});
