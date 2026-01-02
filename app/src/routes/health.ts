import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { ErrorModelSchema, HealthResponseSchema } from "../plugins/schema-registry.js";

const health: FastifyPluginAsyncTypebox = async (fastify): Promise<void> => {
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
