import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";
import fp from "fastify-plugin";
import type { OpenAPIV3_1 } from "openapi-types";

/**
 * Schema Discovery Routes
 *
 * Serves JSON Schemas extracted from the OpenAPI specification.
 * Schemas are retrieved from `fastify.swagger().components.schemas` at startup.
 * Only schemas referenced by route definitions will be discoverable here.
 *
 * @see https://json-schema.org/draft/2020-12/json-schema-core.html
 * @see https://spec.openapis.org/oas/v3.1.0#schema-object
 */
const schemasRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  let openapiSchemas: Record<string, OpenAPIV3_1.SchemaObject> = {};

  fastify.addHook("onReady", async () => {
    const openapi = fastify.swagger() as OpenAPIV3_1.Document;
    openapiSchemas = (openapi.components?.schemas as Record<string, OpenAPIV3_1.SchemaObject>) ?? {};
  });

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
      const schema = openapiSchemas[name];

      if (!schema) {
        throw fastify.httpErrors.notFound(`Schema '${name}' not found`);
      }

      return reply.type("application/schema+json").send(schema);
    },
  );
};

export default fp(schemasRoutes, {
  name: "@app/schemas-routes",
  fastify: "5.x",
  dependencies: ["swagger"],
});
