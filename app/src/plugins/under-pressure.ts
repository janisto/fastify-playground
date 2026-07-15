import underPressure from "@fastify/under-pressure";
import fp from "fastify-plugin";

export interface UnderPressurePluginOptions {
  maxEventLoopDelay?: number;
  maxEventLoopUtilization?: number;
  retryAfter?: number;
}

/** Rejects non-liveness traffic when the Node.js process is too overloaded to respond reliably. */
export default fp<UnderPressurePluginOptions>(
  async (fastify, options) => {
    const { maxEventLoopDelay = 1000, maxEventLoopUtilization = 0.98, retryAfter = 10 } = options;

    await fastify.register(underPressure, {
      maxEventLoopDelay,
      maxEventLoopUtilization,
      retryAfter,
    });
  },
  {
    name: "under-pressure",
    fastify: "5.x",
  },
);
