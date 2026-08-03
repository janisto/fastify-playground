import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";
import { ErrorModelSchema } from "../schemas/index.js";
import { API_MEDIA_TYPES } from "../utils/content-negotiation.js";

export const HealthResponseSchema = Type.Object(
  {
    status: Type.Literal("healthy", {
      description: "Health status indicator",
      examples: ["healthy"],
    }),
  },
  {
    $id: "HealthResponse",
    additionalProperties: false,
    description: "Successful response indicating the API is healthy",
  },
);

export const ReadinessResponseSchema = Type.Object(
  {
    status: Type.Literal("ready", {
      description: "Readiness status indicator",
      examples: ["ready"],
    }),
  },
  {
    $id: "ReadinessResponse",
    description: "Successful response indicating the API can accept traffic",
  },
);

const health: FastifyPluginAsyncTypebox = async (fastify): Promise<void> => {
  fastify.addSchema(HealthResponseSchema);
  fastify.addSchema(ReadinessResponseSchema);
  fastify.get(
    "/health",
    {
      config: {
        allowDuringShutdown: true,
        pressureHandler: () => undefined,
      },
      schema: {
        operationId: "getHealth",
        description: "Confirms that the API process is running without checking external dependencies",
        produces: API_MEDIA_TYPES,
        security: [],
        tags: ["Health"],
        summary: "Liveness check",
        response: {
          200: HealthResponseSchema,
          400: ErrorModelSchema,
          406: ErrorModelSchema,
          500: ErrorModelSchema,
        },
      },
    },
    async () => {
      return { status: "healthy" as const };
    },
  );

  fastify.get(
    "/status",
    {
      config: {
        allowDuringShutdown: true,
      },
      schema: {
        operationId: "getReadiness",
        description: "Confirms that the API process is ready and not shutting down or under excessive load",
        produces: ["application/json"],
        tags: ["Health"],
        summary: "Readiness check",
        response: {
          200: ReadinessResponseSchema,
          406: ErrorModelSchema,
          503: ErrorModelSchema,
        },
      },
    },
    async (_request, reply) => {
      if (fastify.isShuttingDown) {
        reply.header("Retry-After", "10");
        throw fastify.httpErrors.serviceUnavailable("Service is shutting down");
      }
      return { status: "ready" as const };
    },
  );
};

export default health;
