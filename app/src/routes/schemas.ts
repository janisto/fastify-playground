import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";
import fp from "fastify-plugin";
import type { OpenAPIV3_1 } from "openapi-types";
import { SCHEMA_JSON_MEDIA_TYPE } from "../utils/content-negotiation.js";

const COMPONENT_REFERENCE_PREFIX = "#/components/schemas/";
const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";

type SchemaDocument = Record<string, unknown>;

function rewriteComponentReferences(value: unknown, referenced: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) rewriteComponentReferences(item, referenced);
    return;
  }
  if (!value || typeof value !== "object") return;

  const record = value as SchemaDocument;
  const reference = record["$ref"];
  if (typeof reference === "string" && reference.startsWith(COMPONENT_REFERENCE_PREFIX)) {
    const schemaName = reference.slice(COMPONENT_REFERENCE_PREFIX.length);
    referenced.add(schemaName);
    record["$ref"] = `#/$defs/${schemaName}`;
  }

  for (const child of Object.values(record)) rewriteComponentReferences(child, referenced);
}

function buildStandaloneSchema(
  schemaName: string,
  components: Readonly<Record<string, OpenAPIV3_1.SchemaObject>>,
): SchemaDocument {
  const component = components[schemaName];
  if (!component) throw new Error(`Missing OpenAPI component '${schemaName}'`);

  const schema = structuredClone(component) as SchemaDocument;
  const referenced = new Set<string>();
  rewriteComponentReferences(schema, referenced);

  const definitions: Record<string, SchemaDocument> = {};
  for (const referencedName of referenced) {
    if (definitions[referencedName]) continue;
    const referencedComponent = components[referencedName];
    if (!referencedComponent) throw new Error(`Missing referenced OpenAPI component '${referencedName}'`);

    const definition = structuredClone(referencedComponent) as SchemaDocument;
    definitions[referencedName] = definition;
    rewriteComponentReferences(definition, referenced);
  }

  schema["$schema"] = JSON_SCHEMA_DIALECT;
  if (Object.keys(definitions).length > 0) schema["$defs"] = definitions;
  return schema;
}

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
  let schemaDocuments: Record<string, SchemaDocument> = {};

  fastify.addHook("onReady", async () => {
    const openapi = fastify.swagger() as OpenAPIV3_1.Document;
    const components = (openapi.components?.schemas as Record<string, OpenAPIV3_1.SchemaObject>) ?? {};
    schemaDocuments = Object.fromEntries(
      Object.keys(components).map((schemaName) => [schemaName, buildStandaloneSchema(schemaName, components)]),
    );
  });

  fastify.get(
    "/schemas/:schemaName",
    {
      schema: {
        hide: true,
        produces: [SCHEMA_JSON_MEDIA_TYPE],
        params: Type.Object({
          schemaName: Type.String({ pattern: "^[A-Za-z][A-Za-z0-9]*\\.json$" }),
        }),
      },
    },
    async (request, reply) => {
      const { schemaName } = request.params;
      const name = schemaName.replace(/\.json$/, "");
      const schema = schemaDocuments[name];

      if (!schema) {
        throw fastify.httpErrors.notFound(`Schema '${name}' not found`);
      }

      return reply.type(SCHEMA_JSON_MEDIA_TYPE).send(schema);
    },
  );
};

export default fp(schemasRoutes, {
  name: "@app/schemas-routes",
  fastify: "5.x",
  dependencies: ["swagger"],
});
