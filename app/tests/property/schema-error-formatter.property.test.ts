import { fc, test } from "@fast-check/vitest";
import type { FastifySchemaValidationError } from "fastify/types/schema.js";
import { expect } from "vitest";
import { schemaErrorFormatter } from "../../src/utils/schema-error-formatter.js";
import { propertyParameters } from "./config.js";

const frameworkError = fc.record({
  instancePath: fc.string({ maxLength: 80 }),
  token: fc.stringMatching(/^[A-Za-z0-9]{1,40}$/),
});

test.prop([fc.array(frameworkError, { maxLength: 80 }), fc.string({ maxLength: 20 })], propertyParameters)(
  "never exposes framework messages, rejected values, or more than 32 issues",
  (inputs, context) => {
    const errors = inputs.map(
      ({ instancePath, token }): FastifySchemaValidationError => ({
        instancePath,
        message: `framework-message-${token}`,
        keyword: "type",
        schemaPath: "#/private",
        params: { privateValue: `rejected-value-${token}` },
      }),
    );
    const output = schemaErrorFormatter(errors, context).formattedErrors;
    const serialized = JSON.stringify(output);

    expect(output.length).toBeLessThanOrEqual(32);
    for (const input of inputs) {
      expect(serialized).not.toContain(`framework-message-${input.token}`);
      expect(serialized).not.toContain(`rejected-value-${input.token}`);
    }
    expect(
      output.every((issue) => issue.detail === "Request validation failed" || issue.detail.endsWith("omitted")),
    ).toBe(true);
  },
);
