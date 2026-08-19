import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { ErrorModelSchema } from "../../schemas/index.js";
import { API_MEDIA_TYPES } from "../../utils/content-negotiation.js";
import { buildLinkHeader } from "../../utils/pagination.js";
import { ItemsQuerySchema, ItemsResponseSchema } from "./schemas.js";
import { ItemsService } from "./service.js";

const itemsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const service = new ItemsService();

  fastify.addSchema(ItemsResponseSchema);

  fastify.get(
    "/",
    {
      prefixTrailingSlash: "no-slash",
      schema: {
        operationId: "listItems",
        security: [],
        description: "Returns a paginated list of items",
        summary: "List items",
        tags: ["Items"],
        produces: API_MEDIA_TYPES,
        querystring: ItemsQuerySchema,
        response: {
          200: ItemsResponseSchema,
          400: ErrorModelSchema,
          406: ErrorModelSchema,
          422: ErrorModelSchema,
          500: ErrorModelSchema,
        },
      },
    },
    async (request, reply) => {
      const { limit = 20, category } = request.query;

      const result = service.list(request.query);

      const query = new URLSearchParams();
      if (category) query.set("category", category);
      query.set("limit", String(limit));

      const linkHeader = buildLinkHeader("/v1/items", query, result.nextCursor, result.prevCursor);
      if (linkHeader) {
        reply.header("Link", linkHeader);
      }

      return { items: result.items, total: result.total };
    },
  );
};

export default itemsRoutes;
