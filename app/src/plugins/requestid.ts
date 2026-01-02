import { randomUUID } from "node:crypto";
import fp from "fastify-plugin";

const MAX_REQUEST_ID_LENGTH = 128;

/**
 * Validates a request ID to prevent log injection attacks.
 * Only accepts ASCII printable characters (0x20-0x7E) with limited length.
 */
export function isValidRequestId(id: string): boolean {
  if (!id || id.length > MAX_REQUEST_ID_LENGTH) return false;
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

/**
 * Request ID plugin for Fastify.
 *
 * This plugin provides:
 * - Automatic request ID generation (or uses client-provided X-Request-Id header)
 * - Request ID validation to prevent log injection attacks
 *
 * The request ID is:
 * - Validated for ASCII printable characters and max 128 chars
 * - Generated using UUID v4 if not provided or invalid
 * - Attached to request.id
 * - Added to response headers (X-Request-Id)
 */
export default fp(
  async (fastify) => {
    fastify.addHook("onRequest", async (request, reply) => {
      // Use client-provided request ID if valid, otherwise generate a new one
      const providedId = request.headers["x-request-id"] as string | undefined;
      const requestId = providedId && isValidRequestId(providedId) ? providedId : randomUUID();

      // Store request ID
      request.id = requestId;

      // Add request ID to response headers
      reply.header("X-Request-Id", requestId);
    });
  },
  {
    name: "requestid",
    fastify: "5.x",
  },
);
