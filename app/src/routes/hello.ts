import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";
import { HelloResponseSchema } from "../plugins/schema-registry.js";

const HelloInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100, description: "Name to greet" }),
  },
  { additionalProperties: false },
);

const helloRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/hello",
    {
      schema: {
        description: "Get a greeting message",
        summary: "Hello World",
        tags: ["Hello"],
        response: {
          200: HelloResponseSchema,
        },
      },
    },
    async () => {
      return { message: "Hello, World!" };
    },
  );

  fastify.post(
    "/hello",
    {
      schema: {
        description: "Create a personalized greeting",
        summary: "Create greeting",
        tags: ["Hello"],
        body: HelloInputSchema,
        response: {
          201: HelloResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { name } = request.body;
      return reply.code(201).send({ message: `Hello, ${name}!` });
    },
  );
};

export default helloRoutes;
