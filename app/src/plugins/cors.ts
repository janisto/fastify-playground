import cors from "@fastify/cors";
import fp from "fastify-plugin";

export interface CorsPluginOptions {
  readonly origins?: readonly string[];
}

/**
 * CORS (Cross-Origin Resource Sharing) plugin for Fastify.
 *
 * This plugin configures CORS to:
 * - Allow requests from an explicit, startup-validated origin allowlist
 * - Allow requests with no origin (mobile apps, Postman, curl)
 * - Omit CORS response headers for all other origins
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
export default fp<CorsPluginOptions>(
  async (fastify, options) => {
    const allowedOrigins = new Set(options.origins ?? []);

    await fastify.register(cors, {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        callback(null, allowedOrigins.has(origin));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Accept", "Authorization", "Content-Type", "X-Request-Id", "traceparent", "tracestate"],
      exposedHeaders: ["Link", "Location", "Retry-After", "X-RateLimit-Reset", "X-Request-Id"],
    });
  },
  {
    name: "cors",
    fastify: "5.x",
  },
);
