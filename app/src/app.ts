import { randomBytes } from "node:crypto";
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
import type { ProfileRepository } from "./modules/profile/index.js";
import type { ProfileClock } from "./modules/profile/service.js";
import authPlugin from "./plugins/auth.js";
import contentNegotiationPlugin from "./plugins/content-negotiation.js";
import corsPlugin from "./plugins/cors.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import firebasePlugin from "./plugins/firebase.js";
import helmetPlugin from "./plugins/helmet.js";
import lifecyclePlugin from "./plugins/lifecycle.js";
import portableHttpPlugin from "./plugins/portable-http.js";
import requestBodyPlugin, { MAX_REQUEST_BODY_BYTES } from "./plugins/request-body.js";
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
 * 2. Core: sensible, portable error handling, helmet, cors
 * 3. HTTP lifecycle: Vary, CBOR parsing, content negotiation
 * 4. Infrastructure: Firebase Auth, lifecycle, Swagger, process pressure
 * 5. Application: auth
 * 6. Response metadata: schema registry and discovery
 * 7. Routes: health, schemas, and versioned modules
 */
export interface BuildAppOptions {
  readonly loggerDestination?: ObservabilityLoggerOptions["destination"];
  readonly loggerLevel?: ObservabilityLoggerOptions["level"];
  readonly profileClock?: ProfileClock;
  readonly profileRepository?: ProfileRepository;
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
    genReqId: createRequestIdGenerator({
      generate: () => randomBytes(16).toString("hex"),
      validateIncoming: (value) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value),
    }),
    bodyLimit: MAX_REQUEST_BODY_BYTES,
    exposeHeadRoutes: false,
    logController: new LogController({
      disableRequestLogging: true,
      requestIdLogLabel: "request_id",
    }),
    schemaErrorFormatter,
  })
    .setValidatorCompiler(TypeBoxValidatorCompiler)
    .withTypeProvider<TypeBoxTypeProvider>();

  try {
    // Layer 1: Observability must precede every application hook and route.
    await fastify.register(fastifyObservability, OBSERVABILITY_OPTIONS);

    // Layer 2: Core plugins
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandlerPlugin);
    await fastify.register(helmetPlugin);
    await fastify.register(corsPlugin, { origins: env.CORS_ORIGINS });

    // Layer 3: HTTP lifecycle and content negotiation plugins
    await fastify.register(varyHeaderPlugin);
    await fastify.register(portableHttpPlugin);
    await fastify.register(requestBodyPlugin);
    await fastify.register(contentNegotiationPlugin);

    // Layer 4: Infrastructure plugins
    await fastify.register(firebasePlugin);
    await fastify.register(lifecyclePlugin);
    await fastify.register(swaggerPlugin);
    await fastify.register(underPressurePlugin);

    // Layer 5: Application plugins
    await fastify.register(authPlugin);

    // Layer 6: Response transformation plugins
    await fastify.register(schemaRegistryPlugin);
    await fastify.register(schemaDiscoveryPlugin);

    // Layer 7: Routes
    // Infrastructure routes (unversioned)
    await fastify.register(healthRoutes);
    await fastify.register(schemasRoutes);

    // Business routes (versioned)
    await fastify.register(v1Routes, {
      prefix: "/v1",
      ...(options.profileClock === undefined ? {} : { profileClock: options.profileClock }),
      ...(options.profileRepository === undefined ? {} : { profileRepository: options.profileRepository }),
    });
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
