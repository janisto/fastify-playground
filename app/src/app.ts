import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type, TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import { env } from "./env.js";
import authPlugin from "./plugins/auth.js";
import corsPlugin from "./plugins/cors.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import firebasePlugin from "./plugins/firebase.js";
import helmetPlugin from "./plugins/helmet.js";
import lifecyclePlugin from "./plugins/lifecycle.js";
import requestLoggingPlugin from "./plugins/request-logging.js";
import sensiblePlugin from "./plugins/sensible.js";
import swaggerPlugin from "./plugins/swagger.js";
import underPressurePlugin from "./plugins/under-pressure.js";
import healthRoutes from "./routes/health.js";
import rootRoutes from "./routes/root.js";

/**
 * Build and configure the Fastify application.
 *
 * Plugins are registered in dependency order:
 * 1. Core: sensible, helmet, cors (no dependencies)
 * 2. Infrastructure: firebase, lifecycle, under-pressure, swagger
 * 3. Application: auth, error-handler, request-logging
 * 4. Routes: health, root
 */
export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Cloud Run / Firebase App Hosting optimized configuration:
      // - Logs to stdout (Pino default)
      // - JSON format (Pino default)
      // - No file transport (Pino default)
      formatters: {
        level: (label) => {
          // Cloud Logging severity mapping
          return { severity: label.toUpperCase() };
        },
      },
    },
  })
    .setValidatorCompiler(TypeBoxValidatorCompiler)
    .withTypeProvider<TypeBoxTypeProvider>();

  // Layer 1: Core plugins (no dependencies)
  await fastify.register(sensiblePlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(corsPlugin);

  // Layer 2: Infrastructure plugins
  await fastify.register(firebasePlugin);
  await fastify.register(lifecyclePlugin);
  await fastify.register(underPressurePlugin);
  await fastify.register(swaggerPlugin);

  // Layer 3: Application plugins
  await fastify.register(authPlugin);
  await fastify.register(errorHandlerPlugin);
  await fastify.register(requestLoggingPlugin);

  // Layer 4: Routes
  await fastify.register(healthRoutes);
  await fastify.register(rootRoutes);

  return fastify;
}

export { Type };

// Start server when run directly (development mode with tsx)
// In production, use: node dist/app.js
/* v8 ignore start -- @preserve */
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const fastify = await buildApp();

    await fastify.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}
/* v8 ignore stop -- @preserve */
