import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import { env } from "./env.js";
import acceptsSerializerPlugin from "./plugins/accepts-serializer.js";
import authPlugin from "./plugins/auth.js";
import cborParserPlugin from "./plugins/cbor-parser.js";
import corsPlugin from "./plugins/cors.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import firebasePlugin from "./plugins/firebase.js";
import helmetPlugin from "./plugins/helmet.js";
import lifecyclePlugin from "./plugins/lifecycle.js";
import loggingPlugin from "./plugins/logging.js";
import requestidPlugin from "./plugins/requestid.js";
import schemaDiscoveryPlugin from "./plugins/schema-discovery.js";
import schemaRegistryPlugin from "./plugins/schema-registry.js";
import sensiblePlugin from "./plugins/sensible.js";
import swaggerPlugin from "./plugins/swagger.js";
import underPressurePlugin from "./plugins/under-pressure.js";
import varyHeaderPlugin from "./plugins/vary-header.js";
import healthRoutes from "./routes/health.js";
import schemasRoutes from "./routes/schemas.js";
import v1Routes from "./routes/v1.js";
import { schemaErrorFormatter } from "./utils/schema-error-formatter.js";

/**
 * Build and configure the Fastify application.
 *
 * Plugins are registered in dependency order:
 * 1. Core: sensible, helmet, cors (no dependencies)
 * 2. Content negotiation: cbor-parser, accepts-serializer, vary-header
 * 3. Infrastructure: firebase, lifecycle, under-pressure, swagger
 * 4. Application: auth, error-handler, requestid, logging
 * 5. Routes: health, root
 */
export async function buildApp() {
  const fastify = Fastify({
    connectionTimeout: 10000,
    requestTimeout: 30000,
    disableRequestLogging: true,
    schemaErrorFormatter,
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

  // Layer 2: Content negotiation plugins
  await fastify.register(cborParserPlugin);
  await fastify.register(acceptsSerializerPlugin);
  await fastify.register(varyHeaderPlugin);

  // Layer 3: Infrastructure plugins
  await fastify.register(firebasePlugin);
  await fastify.register(lifecyclePlugin);
  await fastify.register(underPressurePlugin);
  await fastify.register(swaggerPlugin);

  // Layer 4: Application plugins
  await fastify.register(authPlugin);
  await fastify.register(errorHandlerPlugin);
  await fastify.register(requestidPlugin);
  await fastify.register(loggingPlugin);

  // Layer 5: Response transformation plugins
  await fastify.register(schemaRegistryPlugin);
  await fastify.register(schemaDiscoveryPlugin);

  // Layer 6: Routes
  // Infrastructure routes (unversioned)
  await fastify.register(healthRoutes);
  await fastify.register(schemasRoutes);

  // Business routes (versioned)
  await fastify.register(v1Routes, { prefix: "/v1" });

  return fastify;
}

// Start server when run directly (development mode with tsx)
// In production, use: node dist/app.js
/* v8 ignore start -- @preserve */
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const fastify = await buildApp();

    await fastify.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    process.stderr.write(`Failed to start server: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
/* v8 ignore stop -- @preserve */
