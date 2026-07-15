import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";
import { ErrorModelSchema } from "../schemas/index.js";

export const HealthResponseSchema = Type.Object(
  {
    status: Type.Literal("healthy", {
      description: "Health status indicator",
      examples: ["healthy"],
    }),
  },
  {
    $id: "HealthResponse",
    description: "Successful response indicating the API is healthy",
  },
);

const health: FastifyPluginAsyncTypebox = async (fastify): Promise<void> => {
  fastify.addSchema(HealthResponseSchema);
  fastify.get(
    "/health",
    {
      config: {
        pressureHandler: () => undefined,
      },
      schema: {
        operationId: "getHealth",
        description: "Confirms that the API process is running without checking external dependencies",
        produces: ["application/json"],
        tags: ["Health"],
        summary: "Liveness check",
        response: {
          200: HealthResponseSchema,
          406: ErrorModelSchema,
        },
      },
    },
    async () => {
      return { status: "healthy" as const };
    },
  );
};

export default health;
