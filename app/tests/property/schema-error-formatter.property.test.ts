import { fc, test } from "@fast-check/vitest";
import type { FastifySchemaValidationError } from "fastify/types/schema.js";
import { expect } from "vitest";
import { schemaErrorFormatter } from "../../src/utils/schema-error-formatter.js";
import { propertyParameters } from "./config.js";

const context = fc.constantFrom("body", "querystring", "params", "headers", "custom");
const prefixByContext: Readonly<Record<string, string>> = {
  body: "body",
  custom: "custom",
  headers: "headers",
  params: "path",
  querystring: "query",
};
const errorInput = fc.record({
  message: fc.option(fc.string({ maxLength: 48 }), { nil: undefined }),
  path: fc.array(fc.stringMatching(/^[A-Za-z0-9_.:-]{1,16}$/), { maxLength: 4 }),
});
const keyFragment = fc.stringMatching(/^[A-Za-z0-9_-]{1,16}$/);

function toValidationError(input: { message: string | undefined; path: string[] }): FastifySchemaValidationError {
  const error: FastifySchemaValidationError = {
    instancePath: input.path.length === 0 ? "" : `/${input.path.join("/")}`,
    keyword: "type",
    params: {},
    schemaPath: "#/type",
  };
  if (input.message !== undefined) error.message = input.message;
  return error;
}

test.prop([context, fc.array(errorInput, { maxLength: 24 })], propertyParameters)(
  "formats each location-message pair once in first-seen order",
  (dataVar, inputs) => {
    const errors = inputs.flatMap((input, index) => {
      const error = toValidationError(input);
      return index % 3 === 0 ? [error, error] : [error];
    });
    const prefix = prefixByContext[dataVar] ?? dataVar;
    const expected = new Map<string, { location: string; message: string }>();

    for (const input of inputs) {
      const location = input.path.length === 0 ? prefix : `${prefix}.${input.path.join(".")}`;
      const message = input.message || "validation failed";
      const key = JSON.stringify([location, message]);
      if (!expected.has(key)) expected.set(key, { location, message });
    }

    expect(schemaErrorFormatter(errors, dataVar).formattedErrors).toEqual([...expected.values()]);
  },
);

test.prop([context, keyFragment, keyFragment, keyFragment], propertyParameters)(
  "keeps distinct location-message pairs whose delimiter forms collide",
  (dataVar, locationFragment, messagePrefix, messageSuffix) => {
    const prefix = prefixByContext[dataVar] ?? dataVar;
    const errors = [
      toValidationError({ message: `${messagePrefix}:${messageSuffix}`, path: [locationFragment] }),
      toValidationError({ message: messageSuffix, path: [`${locationFragment}:${messagePrefix}`] }),
    ];

    expect(schemaErrorFormatter(errors, dataVar).formattedErrors).toEqual([
      { location: `${prefix}.${locationFragment}`, message: `${messagePrefix}:${messageSuffix}` },
      { location: `${prefix}.${locationFragment}:${messagePrefix}`, message: messageSuffix },
    ]);
  },
);
