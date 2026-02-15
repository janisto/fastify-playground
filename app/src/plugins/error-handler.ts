import * as http from "node:http";
import { encode as cborEncode } from "cbor2";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { env } from "../env.js";
import { GitHubApiError, InvalidCursorError } from "../modules/github/errors.js";
import { prefersCbor } from "../utils/cbor.js";
import { addSchemaLinkHeader } from "../utils/link-header.js";
import type { SchemaValidationError } from "../utils/schema-error-formatter.js";
import { buildSchemaUrl } from "../utils/schema-url.js";

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

function logError(request: FastifyRequest, error: Error, statusCode: number): void {
  if (statusCode >= 500) {
    request.log.error({ err: error, requestId: request.id }, "Server error");
  } else {
    request.log.warn({ err: error, requestId: request.id }, "Client error");
  }
}

function mapGitHubErrorCode(code: string): number {
  switch (code) {
    case "github_not_found":
      return 404;
    case "github_rate_limit":
      return 429;
    case "github_forbidden":
      return 403;
    default:
      return 502;
  }
}

function sendProblemDetails(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  problemDetails: Record<string, unknown>,
): void {
  reply.header("X-Request-ID", request.id);
  reply.header("Vary", "Accept");
  addSchemaLinkHeader(reply, "ErrorModel");

  if (prefersCbor(request.headers.accept)) {
    reply
      .status(statusCode)
      .type("application/problem+cbor")
      .send(Buffer.from(cborEncode(problemDetails)));
    return;
  }
  reply.status(statusCode).type("application/problem+json").send(problemDetails);
}

function handleGitHubApiError(error: Error, request: FastifyRequest, reply: FastifyReply): boolean {
  if (!(error instanceof GitHubApiError)) return false;

  const httpStatus = mapGitHubErrorCode(error.code);
  const schemaUrl = buildSchemaUrl(request, "ErrorModel");

  if (error.retryAfter) {
    reply.header("Retry-After", error.retryAfter);
  }

  logError(request, error, httpStatus);

  const problemDetails = {
    $schema: schemaUrl,
    /* v8 ignore next -- @preserve */
    title: http.STATUS_CODES[httpStatus] || "Error",
    status: httpStatus,
    detail: error.message,
  };

  sendProblemDetails(request, reply, httpStatus, problemDetails);
  return true;
}

function handleInvalidCursorError(error: Error, request: FastifyRequest, reply: FastifyReply): boolean {
  if (!(error instanceof InvalidCursorError)) return false;

  const httpStatus = 400;
  const schemaUrl = buildSchemaUrl(request, "ErrorModel");

  logError(request, error, httpStatus);

  const problemDetails = {
    $schema: schemaUrl,
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
 * - Logs errors appropriately based on status code (error/warn)
 * - Handles validation errors with structured errors array
 * - Supports CBOR content negotiation (application/problem+cbor)
 * - Hides internal details in production for 5xx errors
 *
 * RFC 9457 Problem Details response format:
 * ```json
 * {
 *   "$schema": "http://host/schemas/ProblemDetails.json",
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
      const schemaUrl = buildSchemaUrl(request, "ErrorModel");
      const detail = determineErrorDetail(error, statusCode);

      logError(request, error, statusCode);

      const problemDetails: Record<string, unknown> = {
        $schema: schemaUrl,
        /* v8 ignore next -- @preserve */
        title: http.STATUS_CODES[statusCode] || "Error",
        status: statusCode,
        detail,
      };

      if (error.validation) {
        const validationError = error as unknown as SchemaValidationError;
        problemDetails.errors = validationError.formattedErrors;
      }

      reply.header("X-Request-ID", request.id);
      reply.header("Vary", "Accept");
      addSchemaLinkHeader(reply, "ErrorModel");

      if (prefersCbor(request.headers.accept)) {
        return reply
          .status(statusCode)
          .type("application/problem+cbor")
          .send(Buffer.from(cborEncode(problemDetails)));
      }

      return reply.status(statusCode).type("application/problem+json").send(problemDetails);
    });

    fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
      const schemaUrl = buildSchemaUrl(request, "ErrorModel");
      const problemDetails = {
        $schema: schemaUrl,
        title: "Not Found",
        status: 404,
        detail: "resource not found",
      };

      reply.header("X-Request-ID", request.id);
      reply.header("Vary", "Accept");
      addSchemaLinkHeader(reply, "ErrorModel");

      if (prefersCbor(request.headers.accept)) {
        return reply
          .status(404)
          .type("application/problem+cbor")
          .send(Buffer.from(cborEncode(problemDetails)));
      }

      return reply.status(404).type("application/problem+json").send(problemDetails);
    });
  },
  {
    name: "@app/error-handler",
    fastify: "5.x",
    dependencies: ["sensible"],
  },
);
