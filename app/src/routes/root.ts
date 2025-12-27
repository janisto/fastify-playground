import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";

const root: FastifyPluginAsyncTypebox = async (fastify, _opts): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        description: "Root endpoint of the API",
        tags: ["general"],
        summary: "API root",
        response: {
          200: Type.Object(
            {
              root: Type.Boolean({
                description: "Indicates this is the root endpoint",
                examples: [true],
              }),
            },
            {
              description: "Successful response from the root endpoint",
            },
          ),
        },
      },
    },
    async (_request, _reply) => ({ root: true }),
  );
};

export default root;
