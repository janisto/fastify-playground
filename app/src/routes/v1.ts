import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { helloRoutes } from "../modules/hello/index.js";
import { itemsRoutes } from "../modules/items/index.js";

/**
 * V1 API router plugin.
 *
 * Registers all versioned business routes under /v1 prefix.
 * Add new modules here to include them in the v1 API.
 */
const v1Routes: FastifyPluginAsyncTypebox = async (fastify) => {
  await fastify.register(helloRoutes, { prefix: "/hello" });
  await fastify.register(itemsRoutes, { prefix: "/items" });
};

export default v1Routes;
