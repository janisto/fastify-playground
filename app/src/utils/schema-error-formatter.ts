import type { FastifySchemaValidationError } from "fastify/types/schema.js";

/**
 * Formatted validation error for RFC 9457 Problem Details response.
 */
export interface FormattedValidationError {
  message: string;
  location: string;
}

/**
 * Custom Fastify validation error with pre-formatted errors.
 */
export interface SchemaValidationError extends Error {
  statusCode: number;
  code: string;
  validation: FastifySchemaValidationError[];
  validationContext?: string;
  formattedErrors: FormattedValidationError[];
}

const CONTEXT_TO_PREFIX: Record<string, string> = {
  querystring: "query",
  params: "path",
  headers: "headers",
  body: "body",
};

function buildLocation(instancePath: string, dataVar: string): string {
  const prefix = CONTEXT_TO_PREFIX[dataVar] || dataVar;
  const fieldPath = instancePath ? instancePath.replace(/^\//, "").replace(/\//g, ".") : "";
  return fieldPath ? `${prefix}.${fieldPath}` : prefix;
}

function buildMessage(error: FastifySchemaValidationError): string {
  return error.message || "validation failed";
}

function formatErrors(errors: FastifySchemaValidationError[], dataVar: string): FormattedValidationError[] {
  const uniqueErrors = new Map<string, FormattedValidationError>();

  for (const error of errors) {
    const message = buildMessage(error);
    const location = buildLocation(error.instancePath || "", dataVar);
    const key = `${location}:${message}`;

    if (!uniqueErrors.has(key)) {
      uniqueErrors.set(key, { message, location });
    }
  }

  return Array.from(uniqueErrors.values());
}

/**
 * Schema error formatter for Fastify.
 *
 * This function formats validation errors into a structured format suitable for
 * RFC 9457 Problem Details responses. It pre-processes Ajv validation errors
 * and attaches them to the error object for use in the error handler.
 *
 * @param errors - Array of Fastify schema validation errors from Ajv
 * @param dataVar - The validation context (body, querystring, params, headers)
 * @returns An Error object with formatted validation errors attached
 *
 * @see https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/#schemaerrorformatter
 */
export function schemaErrorFormatter(errors: FastifySchemaValidationError[], dataVar: string): SchemaValidationError {
  const formattedErrors = formatErrors(errors, dataVar);
  const message = "validation failed";

  const error = new Error(message) as SchemaValidationError;
  error.statusCode = 422;
  error.code = "FST_ERR_VALIDATION";
  error.validation = errors;
  error.validationContext = dataVar;
  error.formattedErrors = formattedErrors;

  return error;
}
