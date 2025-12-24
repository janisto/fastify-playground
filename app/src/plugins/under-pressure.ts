import underPressure from "@fastify/under-pressure";
import fp from "fastify-plugin";

/**
 * Options for the Under Pressure plugin.
 */
export interface UnderPressurePluginOptions {
  /**
   * Timeout in milliseconds for the Firestore health check.
   * If the check doesn't complete within this time, it's considered unhealthy.
   *
   * @default 5000
   */
  healthCheckTimeout?: number;

  /**
   * Interval in milliseconds between background health checks.
   *
   * @default 60000
   */
  healthCheckInterval?: number;
}

/**
 * Under Pressure plugin for Fastify.
 *
 * This plugin provides:
 * - Health checks at `/status` endpoint with Firestore connectivity check
 * - System pressure monitoring (memory, event loop)
 * - Graceful degradation when server is under pressure
 * - Automatic "Service Unavailable" responses when thresholds exceeded
 *
 * Health check behavior:
 * - Returns unhealthy when `fastify.isShuttingDown` is true
 * - Checks Firestore connectivity by querying `_health` collection
 * - Includes configurable timeout to prevent hanging health checks
 * - Runs every 60 seconds in background (configurable)
 *
 * @see https://github.com/fastify/under-pressure
 */
export default fp<UnderPressurePluginOptions>(
  async (fastify, options) => {
    const { healthCheckTimeout = 5000, healthCheckInterval = 60000 } = options;

    await fastify.register(underPressure, {
      healthCheck: async (fastifyInstance) => {
        // Return unhealthy during shutdown
        if (fastifyInstance.isShuttingDown) {
          return false;
        }

        // Check Firestore connectivity with timeout
        const createTimeoutPromise = (timeoutMs: number) => {
          let timeoutId: ReturnType<typeof setTimeout>;
          const promise = new Promise<never>((_resolve, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error(`Firestore health check timed out after ${timeoutMs}ms`));
            }, timeoutMs);
          });
          return { promise, clear: () => clearTimeout(timeoutId) };
        };

        const timeout = createTimeoutPromise(healthCheckTimeout);
        try {
          const healthCheckPromise = fastifyInstance.firestore.collection("_health").limit(1).get();
          await Promise.race([healthCheckPromise, timeout.promise]);
          return true;
        } catch (error) {
          fastifyInstance.log.error({ error, timeout: healthCheckTimeout }, "Firestore health check failed");
          return false;
        } finally {
          timeout.clear();
        }
      },
      healthCheckInterval,
      exposeStatusRoute: {
        url: "/status",
        routeOpts: {
          logLevel: "warn",
        },
      },
    });
  },
  {
    name: "under-pressure",
    fastify: "5.x",
    dependencies: ["firebase", "lifecycle"],
  },
);
