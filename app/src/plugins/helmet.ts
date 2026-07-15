import helmet from "@fastify/helmet";
import fp from "fastify-plugin";

export interface HelmetPluginOptions {
  readonly hsts?: boolean;
}

/**
 * Helmet security headers plugin for Fastify.
 *
 * All headers configured via @fastify/helmet options.
 * Use route-level `helmet: false` or custom config to override per-route.
 *
 * @see https://helmetjs.github.io/
 * @see https://github.com/fastify/fastify-helmet
 */
export default fp<HelmetPluginOptions>(
  async (fastify, options) => {
    await fastify.register(helmet, {
      global: true,
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          "default-src": ["'none'"],
          "frame-ancestors": ["'none'"],
        },
      },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xFrameOptions: { action: "deny" },
      // Disable unused headers
      hsts: options.hsts ?? false,
      dnsPrefetchControl: false,
      originAgentCluster: false,
    });

    // Additional security headers not handled by helmet
    fastify.addHook("onSend", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.header(
        "Permissions-Policy",
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
      );
    });
  },
  {
    name: "helmet",
    fastify: "5.x",
  },
);
