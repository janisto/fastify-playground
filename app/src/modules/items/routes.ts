import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { ErrorModelSchema } from "../../schemas/index.js";
import { buildLinkHeader } from "../../utils/pagination.js";
import { ItemsQuerySchema, ItemsResponseSchema } from "./schemas.js";
import { ItemsService } from "./service.js";

const itemsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const service = new ItemsService();

  fastify.addSchema(ItemsResponseSchema);

  fastify.get(
    "/",
    {
      schema: {
        description: "Returns a paginated list of items",
        summary: "List items",
        tags: ["Items"],
        querystring: ItemsQuerySchema,
        response: {
          200: ItemsResponseSchema,
          400: ErrorModelSchema,
          422: ErrorModelSchema,
          500: ErrorModelSchema,
        },
      },
    },
    async (request, reply) => {
      const { cursor, limit = 20, category } = request.query;

      try {
        const result = service.list({ cursor, limit, category });

        const query = new URLSearchParams();
        if (category) query.set("category", category);
        query.set("limit", String(limit));

        const linkHeader = buildLinkHeader("/v1/items", query, result.nextCursor, result.prevCursor);
        if (linkHeader) {
          reply.header("Link", linkHeader);
        }

        return { items: result.items, total: result.total };
      } catch (error) {
        if (error instanceof Error) {
          throw fastify.httpErrors.badRequest(error.message);
        }
        throw error;
      }
    },
  );
};

export default itemsRoutes;
