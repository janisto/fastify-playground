import underPressure from "@fastify/under-pressure";
import fp from "fastify-plugin";

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
 * - Runs every 30 seconds in background
 *
 * @see https://github.com/fastify/under-pressure
 */
export default fp(
  async (fastify) => {
    await fastify.register(underPressure, {
      healthCheck: async (fastifyInstance) => {
        // Return unhealthy during shutdown
        if (fastifyInstance.isShuttingDown) {
          return false;
        }

        // Check Firestore connectivity
        try {
          await fastifyInstance.firestore.collection("_health").limit(1).get();
          return true;
        } catch (error) {
          fastifyInstance.log.error(error, "Firestore health check failed");
          return false;
        }
      },
      healthCheckInterval: 30000,
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
