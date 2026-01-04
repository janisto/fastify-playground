import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";

import { ErrorModelSchema } from "../schemas/index.js";

export const HealthResponseSchema = Type.Object(
  {
    $schema: Type.Optional(Type.String()),
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
      schema: {
        description: "Check the health status of the API",
        tags: ["Health"],
        summary: "Health check endpoint",
        response: {
          200: HealthResponseSchema,
          503: ErrorModelSchema,
        },
      },
    },
    async () => {
      return { status: "healthy" as const };
    },
  );
};

export default health;
