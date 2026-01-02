import cors, { type FastifyCorsOptions } from "@fastify/cors";
import fp from "fastify-plugin";

/**
 * Precompiled regex for extracting hostname from origin URLs.
 * Matches http(s)://hostname:port or http(s)://hostname patterns.
 * Performance optimization: avoids creating URL objects on every request.
 */
const ORIGIN_HOSTNAME_REGEX = /^https?:\/\/([^/:]+)/;

/**
 * CORS (Cross-Origin Resource Sharing) plugin for Fastify.
 *
 * This plugin configures CORS to:
 * - Allow requests from localhost and 127.0.0.1 (development)
 * - Allow requests with no origin (mobile apps, Postman, curl)
 * - Block all other origins (production security)
 * - Enable credentials (cookies, authorization headers)
 * - Allow traceparent header for W3C Trace Context distributed tracing
 *
 * Security considerations:
 * - In production, maintain an explicit allowlist of trusted origins
 * - Never use wildcard (*) with credentials enabled
 * - Validate origin against your domain whitelist
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
 * @see https://github.com/fastify/fastify-cors
 * @see https://www.w3.org/TR/trace-context/
 */
export default fp<FastifyCorsOptions>(
  async (fastify) => {
    await fastify.register(cors, {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          callback(null, true);
          return;
        }

        // Extract hostname using regex (faster than new URL())
        const match = ORIGIN_HOSTNAME_REGEX.exec(origin);
        if (!match) {
          callback(new Error("Not allowed by CORS"), false);
          return;
        }

        const hostname = match[1];

        // Allow localhost in development
        if (hostname === "localhost" || hostname === "127.0.0.1") {
          callback(null, true);
          return;
        }

        // In production, you should maintain an allowlist
        // For now, deny all other origins
        callback(new Error("Not allowed by CORS"), false);
      },
      credentials: true,
      allowedHeaders: ["Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Request-Id", "traceparent"],
      exposedHeaders: ["Link", "Location", "X-Request-Id"],
    });
  },
  {
    name: "cors",
    fastify: "5.x",
  },
);
