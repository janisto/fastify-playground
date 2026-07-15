import * as http from "node:http";
import { encode as cborEncode } from "cbor2";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { env } from "../env.js";
import { GitHubApiError } from "../modules/github/errors.js";
import { CBOR_MEDIA_TYPE, negotiateProblemMediaType, PROBLEM_JSON_MEDIA_TYPE } from "../utils/content-negotiation.js";
import { addSchemaLinkHeader } from "../utils/link-header.js";
import { InvalidCursorError } from "../utils/pagination.js";
import type { SchemaValidationError } from "../utils/schema-error-formatter.js";

function determineStatusCode(error: FastifyError): number {
  if (error.validation) {
    return 422;
  }
  return error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
}

function determineErrorDetail(error: FastifyError, statusCode: number): string {
  if (statusCode >= 500 && env.NODE_ENV === "production") {
    return "An unexpected error occurred";
  }
  if (error.validation) {
    return "validation failed";
  }
  return error.message;
}

function mapGitHubErrorCode(code: string): number {
  switch (code) {
    case "github_not_found":
      return 404;
    case "github_rate_limit":
      return 429;
    case "github_forbidden":
      return 403;
    case "github_timeout":
      return 504;
    default:
      return 502;
  }
}

function mapGitHubErrorDetail(code: string): string {
  switch (code) {
    case "github_not_found":
      return "GitHub resource not found";
    case "github_rate_limit":
      return "GitHub API rate limit exceeded";
    case "github_forbidden":
      return "GitHub request forbidden";
    case "github_timeout":
      return "GitHub service timed out";
    default:
      return "GitHub service is unavailable";
  }
}

function sendProblemDetails(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  problemDetails: Record<string, unknown>,
): void {
  reply.header("Vary", ["Accept", "Origin"]);
  if (statusCode === 503 && !reply.hasHeader("Retry-After")) {
    reply.header("Retry-After", "10");
  }
  addSchemaLinkHeader(reply, "ErrorModel");

  if (negotiateProblemMediaType(request.headers.accept ?? "") === CBOR_MEDIA_TYPE) {
    reply
      .status(statusCode)
      .type(CBOR_MEDIA_TYPE)
      .send(Buffer.from(cborEncode(problemDetails)));
    return;
  }
  reply.status(statusCode).type(PROBLEM_JSON_MEDIA_TYPE).send(problemDetails);
}

function handleGitHubApiError(error: Error, request: FastifyRequest, reply: FastifyReply): boolean {
  if (!(error instanceof GitHubApiError)) return false;

  const httpStatus = mapGitHubErrorCode(error.code);
  if (error.retryAfter) {
    reply.header("Retry-After", error.retryAfter);
  }

  const problemDetails = {
    /* v8 ignore next -- @preserve */
    title: http.STATUS_CODES[httpStatus] || "Error",
    status: httpStatus,
    detail: mapGitHubErrorDetail(error.code),
  };

  sendProblemDetails(request, reply, httpStatus, problemDetails);
  return true;
}

function handleInvalidCursorError(error: Error, request: FastifyRequest, reply: FastifyReply): boolean {
  if (!(error instanceof InvalidCursorError)) return false;

  const httpStatus = 400;
  const problemDetails = {
    title: "Bad Request",
    status: httpStatus,
    detail: error.message,
  };

  sendProblemDetails(request, reply, httpStatus, problemDetails);
  return true;
}

/**
 * Global error handler plugin for Fastify.
 *
 * This plugin sets up a global error handler that:
 * - Returns RFC 9457 Problem Details format for all errors
 * - Leaves generic error logging to the terminal observability access record
 * - Handles validation errors with structured errors array
 * - Supports CBOR content negotiation with the registered application/cbor media type
 * - Hides internal details in production for 5xx errors
 *
 * RFC 9457 Problem Details response format:
 * ```json
 * {
 *   "title": "Not Found",
 *   "status": 404,
 *   "detail": "Error details here",
 *   "instance": "/requested/path"
 * }
 * ```
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9457
 * @see https://fastify.dev/docs/latest/Reference/Server/#seterrorhandler
 */
export default fp(
  async (fastify) => {
    fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      // Handle specialized error types
      if (handleGitHubApiError(error, request, reply)) return;
      if (handleInvalidCursorError(error, request, reply)) return;

      const statusCode = determineStatusCode(error);
      const detail = determineErrorDetail(error, statusCode);

      const problemDetails: Record<string, unknown> = {
        /* v8 ignore next -- @preserve */
        title: http.STATUS_CODES[statusCode] || "Error",
        status: statusCode,
        detail,
      };

      if (error.validation) {
        const validationError = error as unknown as SchemaValidationError;
        problemDetails["errors"] = validationError.formattedErrors;
      }

      sendProblemDetails(request, reply, statusCode, problemDetails);
    });

    fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
      const problemDetails = {
        title: "Not Found",
        status: 404,
        detail: "resource not found",
      };

      sendProblemDetails(request, reply, 404, problemDetails);
    });
  },
  {
    name: "@app/error-handler",
    fastify: "5.x",
    dependencies: ["sensible"],
  },
);
