import { encode as cborEncode } from "cbor2";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { GitHubApiError } from "../modules/github/errors.js";
import { CBOR_MEDIA_TYPE, negotiateProblemMediaType, PROBLEM_JSON_MEDIA_TYPE } from "../utils/content-negotiation.js";
import { addSchemaLinkHeader } from "../utils/link-header.js";
import { InvalidCursorError } from "../utils/pagination.js";
import { PORTABLE_ERRORS, PortableError, type PortableErrorCode } from "../utils/portable-error.js";
import type { SchemaValidationError } from "../utils/schema-error-formatter.js";

function problem(code: PortableErrorCode, errors?: SchemaValidationError["formattedErrors"]): Record<string, unknown> {
  const definition = PORTABLE_ERRORS[code];
  return {
    title: definition.title,
    status: definition.status,
    detail: definition.detail,
    code,
    ...(errors === undefined || errors.length === 0 ? {} : { errors }),
  };
}

function sendProblemDetails(
  request: FastifyRequest,
  reply: FastifyReply,
  code: PortableErrorCode,
  errors?: SchemaValidationError["formattedErrors"],
): void {
  const statusCode = PORTABLE_ERRORS[code].status;
  reply.header("Vary", ["Accept", "Origin"]);
  addSchemaLinkHeader(reply, "ErrorModel");
  const body = problem(code, errors);

  if (negotiateProblemMediaType(request.headers.accept ?? "") === CBOR_MEDIA_TYPE) {
    reply
      .status(statusCode)
      .type(CBOR_MEDIA_TYPE)
      .send(Buffer.from(cborEncode(body)));
    return;
  }
  reply.status(statusCode).type(PROBLEM_JSON_MEDIA_TYPE).send(body);
}

function githubCode(code: string): PortableErrorCode {
  if (code === "github_not_found") return "github_not_found";
  if (code === "github_rate_limit") return "github_rate_limit";
  if (code === "github_timeout") return "github_timeout";
  return "github_upstream";
}

function classifyError(error: FastifyError): PortableErrorCode {
  if (error instanceof PortableError) return error.code;
  if (error.validation) return "validation_failed";
  if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") return "payload_too_large";
  if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") return "unsupported_media_type";
  switch (error.statusCode) {
    case 400:
      return "invalid_request";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 405:
      return "method_not_allowed";
    case 406:
      return "not_acceptable";
    case 413:
      return "payload_too_large";
    case 415:
      return "unsupported_media_type";
    case 422:
      return "validation_failed";
    case 429:
      return "rate_limited";
    case 503:
      return "dependency_unavailable";
    default:
      return "internal_error";
  }
}

const PORTABLE_METHODS = new Map<string, readonly string[]>([
  ["/health", ["GET"]],
  ["/openapi.json", ["GET"]],
  ["/v1/hello", ["GET", "POST"]],
  ["/v1/items", ["GET"]],
  ["/v1/profile", ["GET", "POST", "PATCH", "DELETE"]],
]);

function allowedMethods(path: string): readonly string[] | undefined {
  const fixed = PORTABLE_METHODS.get(path);
  if (fixed) return fixed;
  if (/^\/v1\/github\/owners\/[^/]+(?:\/repos)?$/.test(path)) return ["GET"];
  if (/^\/v1\/github\/repos\/[^/]+\/[^/]+(?:\/(?:activity|languages|tags))?$/.test(path)) return ["GET"];
  return undefined;
}

export default fp(
  async (fastify) => {
    fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof GitHubApiError) {
        if (error.retryAfter) reply.header("Retry-After", error.retryAfter);
        if (error.rateLimitReset) reply.header("X-RateLimit-Reset", error.rateLimitReset);
        sendProblemDetails(request, reply, githubCode(error.code));
        return;
      }
      if (error instanceof InvalidCursorError) {
        sendProblemDetails(request, reply, "invalid_request");
        return;
      }

      const code = classifyError(error);
      const validationError = error.validation ? (error as unknown as SchemaValidationError) : undefined;
      sendProblemDetails(request, reply, code, validationError?.formattedErrors);
    });

    fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
      const path = (request.raw.url ?? "").split("?", 1)[0] ?? "";
      const methods = allowedMethods(path);
      if (methods && !methods.includes(request.method)) {
        reply.header("Allow", methods.join(", "));
        sendProblemDetails(request, reply, "method_not_allowed");
        return;
      }
      sendProblemDetails(request, reply, "not_found");
    });
  },
  {
    name: "@app/error-handler",
    fastify: "5.x",
    dependencies: ["sensible"],
  },
);
