import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";

/**
 * Schema Discovery Routes
 *
 * Serves JSON Schemas for API response types.
 * Enables clients to discover and validate response structures.
 *
 * @see https://json-schema.org/draft/2020-12/json-schema-core.html
 */
const schemasRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/schemas/:schemaName",
    {
      schema: {
        hide: true,
        params: Type.Object({
          schemaName: Type.String({ pattern: "^[A-Za-z][A-Za-z0-9]*\\.json$" }),
        }),
      },
    },
    async (request, reply) => {
      const { schemaName } = request.params;
      const name = schemaName.replace(/\.json$/, "");
      const schemas = fastify.getSchemas();
      const schema = schemas[name];

      if (!schema) {
        throw fastify.httpErrors.notFound(`Schema '${name}' not found`);
      }

      return reply.type("application/schema+json").send(schema);
    },
  );
};

export default schemasRoutes;
