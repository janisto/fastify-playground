import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { ErrorModelSchema } from "../../schemas/index.js";
import { HelloInputSchema, HelloResponseSchema } from "./schemas.js";
import { HelloService } from "./service.js";

const helloRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const service = new HelloService();

  fastify.addSchema(HelloResponseSchema);

  fastify.get(
    "/",
    {
      schema: {
        description: "Get a greeting message",
        summary: "Hello World",
        tags: ["Hello"],
        response: {
          200: HelloResponseSchema,
          500: ErrorModelSchema,
        },
      },
    },
    async () => {
      return service.greet();
    },
  );

  fastify.post(
    "/",
    {
      schema: {
        description: "Create a personalized greeting",
        summary: "Create greeting",
        tags: ["Hello"],
        body: HelloInputSchema,
        response: {
          201: HelloResponseSchema,
          422: ErrorModelSchema,
          500: ErrorModelSchema,
        },
      },
    },
    async (request, reply) => {
      const result = service.greet(request.body.name);
      return reply.code(201).send(result);
    },
  );
};

export default helloRoutes;
