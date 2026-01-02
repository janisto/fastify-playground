import requestContext from "@fastify/request-context";
import fp from "fastify-plugin";

/**
 * W3C Trace Context traceparent header format.
 * Format: {version}-{trace-id}-{parent-id}-{trace-flags}
 * Example: 00-ab42124a3c573678d4d8b21ba52df3bf-d21f7bc17caa5aba-01
 * @see https://www.w3.org/TR/trace-context/
 */
const TRACEPARENT_REGEX = /^([0-9a-fA-F]{2})-([0-9a-fA-F]{32})-([0-9a-fA-F]{16})-([0-9a-fA-F]{2})$/;

/**
 * Parsed W3C Trace Context traceparent header components.
 */
export interface TraceparentComponents {
  version: string;
  traceId: string;
  spanId: string;
  traceFlags: string;
  sampled: boolean;
}

/**
 * Parses a W3C Trace Context traceparent header.
 * @returns Parsed components or null if invalid format
 */
export function parseTraceparent(header: string | undefined): TraceparentComponents | null {
  if (!header) return null;
  const matches = TRACEPARENT_REGEX.exec(header);
  if (!matches || matches.length !== 5) return null;
  return {
    version: matches[1],
    traceId: matches[2],
    spanId: matches[3],
    traceFlags: matches[4],
    sampled: matches[4] === "01",
  };
}

/**
 * Resolves the Google Cloud Project ID from environment variables.
 * Checked in order: GOOGLE_CLOUD_PROJECT, GCP_PROJECT, GCLOUD_PROJECT, PROJECT_ID
 */
export function resolveProjectId(): string | undefined {
  return (
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || process.env.PROJECT_ID
  );
}

/**
 * Builds Cloud Logging trace fields from traceparent header.
 * @see https://cloud.google.com/logging/docs/structured-logging
 */
export function buildTraceFields(
  traceparent: TraceparentComponents | null,
  projectId: string | undefined,
): Record<string, unknown> {
  if (!traceparent || !projectId) return {};
  return {
    "logging.googleapis.com/trace": `projects/${projectId}/traces/${traceparent.traceId}`,
    "logging.googleapis.com/spanId": traceparent.spanId,
    "logging.googleapis.com/trace_sampled": traceparent.sampled,
  };
}

/**
 * Request logging plugin for Fastify.
 *
 * This plugin provides:
 * - W3C Trace Context (traceparent) header parsing for distributed tracing
 * - Google Cloud Logging trace field integration
 * - Request context storage for the request lifecycle
 * - Automatic response time calculation
 * - Structured request/response logging
 * - Request ID added to all logs via child logger
 *
 * The traceparent header (W3C Trace Context):
 * - Format: {version}-{trace-id}-{parent-id}-{trace-flags}
 * - When valid, adds Cloud Logging trace fields to all request logs
 * - Enables correlation with Google Cloud Trace
 *
 * @see https://github.com/fastify/fastify-request-context
 * @see https://www.w3.org/TR/trace-context/
 */
export default fp(
  async (fastify) => {
    // Register request context plugin
    await fastify.register(requestContext);

    // Resolve project ID once at startup
    const projectId = resolveProjectId();

    // onRequest: Parse traceparent and set up child logger with trace context
    fastify.addHook("onRequest", async (request) => {
      // Parse W3C Trace Context traceparent header
      const traceparentHeader = request.headers.traceparent as string | undefined;
      const traceparent = parseTraceparent(traceparentHeader);

      // Build Cloud Logging trace fields
      const traceFields = buildTraceFields(traceparent, projectId);

      // Create child logger with request ID and trace context for contextual logging
      request.log = request.log.child({ requestId: request.id, ...traceFields });

      // Log incoming request
      request.log.info(
        {
          method: request.method,
          url: request.url,
          userAgent: request.headers["user-agent"],
          ip: request.ip,
        },
        "Incoming request",
      );
    });

    // onResponse: Log completed requests with timing
    fastify.addHook("onResponse", async (request, reply) => {
      const responseTime = reply.elapsedTime;

      request.log.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime,
          contentLength: reply.getHeader("content-length"),
        },
        "Request completed",
      );
    });
  },
  {
    name: "logging",
    fastify: "5.x",
    dependencies: ["requestid"],
  },
);
