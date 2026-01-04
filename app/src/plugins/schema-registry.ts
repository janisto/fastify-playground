import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { ErrorModelSchema } from "../schemas/problem-details.js";

const schemaRegistryPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addSchema(ErrorModelSchema);
};

export default fp(schemaRegistryPlugin, {
  fastify: "5.x",
  name: "@app/schema-registry",
});
