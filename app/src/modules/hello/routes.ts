import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { ErrorModelSchema } from "../../schemas/index.js";
import { API_MEDIA_TYPES } from "../../utils/content-negotiation.js";
import { HelloInputSchema, HelloResponseSchema } from "./schemas.js";
import { HelloService } from "./service.js";

const helloRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const service = new HelloService();

  fastify.addSchema(HelloResponseSchema);

  fastify.get(
    "/",
    {
      schema: {
        operationId: "getGreeting",
        description: "Get a greeting message",
        summary: "Hello World",
        tags: ["Hello"],
        produces: API_MEDIA_TYPES,
        response: {
          200: HelloResponseSchema,
          406: ErrorModelSchema,
          500: ErrorModelSchema,
          503: ErrorModelSchema,
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
        operationId: "createGreeting",
        description: "Returns a personalized greeting without creating a resource",
        summary: "Personalize greeting",
        tags: ["Hello"],
        consumes: API_MEDIA_TYPES,
        produces: API_MEDIA_TYPES,
        body: HelloInputSchema,
        response: {
          200: HelloResponseSchema,
          400: ErrorModelSchema,
          406: ErrorModelSchema,
          415: ErrorModelSchema,
          422: ErrorModelSchema,
          500: ErrorModelSchema,
          503: ErrorModelSchema,
        },
      },
    },
    async (request) => service.greet(request.body.name),
  );
};

export default helloRoutes;
