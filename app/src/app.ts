import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify, { LogController } from "fastify";
import fastifyObservability, {
  createObservabilityLogger,
  createRequestIdGenerator,
  type FastifyObservabilityOptions,
  type ObservabilityLoggerOptions,
} from "fastify-observability";
import { env } from "./env.js";
import authPlugin from "./plugins/auth.js";
import cborParserPlugin from "./plugins/cbor-parser.js";
import contentNegotiationPlugin from "./plugins/content-negotiation.js";
import corsPlugin from "./plugins/cors.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import firebasePlugin from "./plugins/firebase.js";
import helmetPlugin from "./plugins/helmet.js";
import lifecyclePlugin from "./plugins/lifecycle.js";
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

const OBSERVABILITY_OPTIONS = {
  captureError: false,
  capturePath: false,
  capturePeerIp: false,
  captureUserAgent: false,
  traceContextLevel: 1,
} as const satisfies FastifyObservabilityOptions;

/**
 * Build and configure the Fastify application.
 *
 * Plugins are registered in dependency order:
 * 1. Observability: canonical logger, request ID, trace context, access record
 * 2. Core: sensible, helmet, cors (no dependencies)
 * 3. HTTP lifecycle: Vary, CBOR parsing, content negotiation
 * 4. Infrastructure: Firebase Auth, lifecycle, Swagger, process pressure
 * 5. Application: auth, error-handler
 * 6. Response metadata: schema registry and discovery
 * 7. Routes: health, schemas, and versioned modules
 */
export interface BuildAppOptions {
  readonly loggerDestination?: ObservabilityLoggerOptions["destination"];
  readonly loggerLevel?: ObservabilityLoggerOptions["level"];
}

export async function buildApp(options: BuildAppOptions = {}) {
  const logger = createObservabilityLogger({
    preset: "gcp",
    level: options.loggerLevel ?? env.LOG_LEVEL,
    ...(options.loggerDestination === undefined ? {} : { destination: options.loggerDestination }),
  });

  const fastify = Fastify({
    connectionTimeout: 10000,
    requestTimeout: 30000,
    handlerTimeout: 15000,
    return503OnClosing: false,
    loggerInstance: logger,
    requestIdHeader: false,
    genReqId: createRequestIdGenerator(),
    logController: new LogController({
      disableRequestLogging: true,
      requestIdLogLabel: "request_id",
    }),
    schemaErrorFormatter,
  })
    .setValidatorCompiler(TypeBoxValidatorCompiler)
    .withTypeProvider<TypeBoxTypeProvider>();

  fastify.removeContentTypeParser("text/plain");

  try {
    // Layer 1: Observability must precede every application hook and route.
    await fastify.register(fastifyObservability, OBSERVABILITY_OPTIONS);

    // Layer 2: Core plugins (no dependencies)
    await fastify.register(sensiblePlugin);
    await fastify.register(helmetPlugin, { hsts: env.NODE_ENV === "production" });
    await fastify.register(corsPlugin, { origins: env.CORS_ORIGINS });

    // Layer 3: HTTP lifecycle and content negotiation plugins
    await fastify.register(varyHeaderPlugin);
    await fastify.register(cborParserPlugin);
    await fastify.register(contentNegotiationPlugin);

    // Layer 4: Infrastructure plugins
    await fastify.register(firebasePlugin);
    await fastify.register(lifecyclePlugin);
    await fastify.register(swaggerPlugin);
    await fastify.register(underPressurePlugin);

    // Layer 5: Application plugins
    await fastify.register(authPlugin);
    await fastify.register(errorHandlerPlugin);

    // Layer 6: Response transformation plugins
    await fastify.register(schemaRegistryPlugin);
    await fastify.register(schemaDiscoveryPlugin);

    // Layer 7: Routes
    // Infrastructure routes (unversioned)
    await fastify.register(healthRoutes);
    await fastify.register(schemasRoutes);

    // Business routes (versioned)
    await fastify.register(v1Routes, { prefix: "/v1" });
  } catch (startupError) {
    try {
      await fastify.close();
    } catch (cleanupError) {
      throw new AggregateError(
        [startupError, cleanupError],
        "Application startup failed and cleanup did not complete",
        { cause: startupError },
      );
    }
    throw startupError;
  }

  return fastify;
}
