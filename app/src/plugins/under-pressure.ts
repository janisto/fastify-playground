import underPressure from "@fastify/under-pressure";
import fp from "fastify-plugin";

export interface UnderPressurePluginOptions {
  maxEventLoopDelay?: number;
  maxEventLoopUtilization?: number;
  maxHeapUsedBytes?: number;
  retryAfter?: number;
  sampleInterval?: number;
}

/** Rejects non-liveness traffic when the Node.js process is too overloaded to respond reliably. */
export default fp<UnderPressurePluginOptions>(
  async (fastify, options) => {
    const {
      maxEventLoopDelay = 1000,
      maxEventLoopUtilization = 0.98,
      maxHeapUsedBytes,
      retryAfter = 10,
      sampleInterval,
    } = options;

    await fastify.register(underPressure, {
      maxEventLoopDelay,
      maxEventLoopUtilization,
      ...(maxHeapUsedBytes === undefined ? {} : { maxHeapUsedBytes }),
      retryAfter,
      ...(sampleInterval === undefined ? {} : { sampleInterval }),
    });
  },
  {
    name: "under-pressure",
    fastify: "5.x",
  },
);
