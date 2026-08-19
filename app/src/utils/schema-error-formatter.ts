import type { FastifySchemaValidationError } from "fastify/types/schema.js";

export interface FormattedValidationError {
  detail: string;
  source?: { pointer: string } | { parameter: string } | { header: string };
}

export interface SchemaValidationError extends Error {
  statusCode: number;
  code: string;
  validation: FastifySchemaValidationError[];
  validationContext?: string;
  formattedErrors: FormattedValidationError[];
}

const KNOWN_PARAMETERS = new Set(["limit", "cursor", "category", "owner", "repo"]);
const KNOWN_HEADERS = new Set(["Authorization", "Content-Type", "Content-Encoding", "X-Request-ID"]);

function safePointer(instancePath: string): { pointer: string } | undefined {
  if (!instancePath) return undefined;
  const segments = instancePath.split("/").slice(1);
  if (segments.some((segment) => !/^[A-Za-z][A-Za-z0-9]*$/.test(segment))) return undefined;
  return { pointer: `/${segments.join("/")}` };
}

function buildSource(error: FastifySchemaValidationError, dataVar: string): FormattedValidationError["source"] {
  const segment = error.instancePath?.split("/").filter(Boolean).at(0);
  if (dataVar === "body") return safePointer(error.instancePath ?? "");
  if ((dataVar === "querystring" || dataVar === "params") && segment && KNOWN_PARAMETERS.has(segment)) {
    return { parameter: segment };
  }
  if (dataVar === "headers" && segment) {
    const header = [...KNOWN_HEADERS].find((candidate) => candidate.toLowerCase() === segment.toLowerCase());
    if (header) return { header };
  }
  return undefined;
}

function formatErrors(errors: FastifySchemaValidationError[], dataVar: string): FormattedValidationError[] {
  const uniqueErrors = new Map<string, FormattedValidationError>();
  for (const error of errors) {
    const source = buildSource(error, dataVar);
    const formatted = { detail: "Request validation failed", ...(source === undefined ? {} : { source }) };
    uniqueErrors.set(JSON.stringify(formatted), formatted);
  }
  const result = Array.from(uniqueErrors.values());
  if (result.length <= 32) return result;
  return [...result.slice(0, 31), { detail: "Additional validation errors omitted" }];
}

export function schemaErrorFormatter(errors: FastifySchemaValidationError[], dataVar: string): SchemaValidationError {
  const error = new Error("Request validation failed") as SchemaValidationError;
  error.statusCode = 422;
  error.code = "FST_ERR_VALIDATION";
  error.validation = errors;
  error.validationContext = dataVar;
  error.formattedErrors = formatErrors(errors, dataVar);
  return error;
}
