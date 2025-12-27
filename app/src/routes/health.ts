import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";

const health: FastifyPluginAsyncTypebox = async (fastify): Promise<void> => {
  fastify.get(
    "/health",
    {
      schema: {
        description: "Check the health status of the API",
        tags: ["health"],
        summary: "Health check endpoint",
        response: {
          200: Type.Object(
            {
              status: Type.Literal("healthy", {
                description: "Health status indicator",
                examples: ["healthy"],
              }),
            },
            {
              description: "Successful response indicating the API is healthy",
            },
          ),
        },
      },
    },
    async (_request, reply) => {
      return reply.code(200).send({ status: "healthy" });
    },
  );
};

export default health;
