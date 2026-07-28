import type { FastifyPluginAsync, FastifyRequest, RouteOptions } from "fastify";
import fp from "fastify-plugin";
import { addSchemaLinkHeader } from "../utils/link-header.js";

interface SchemaWithId {
  $ref?: string;
  $id?: string;
}

function getSchemaName(request: FastifyRequest, statusCode: number): string | undefined {
  const routeOptions = request.routeOptions as RouteOptions;
  const responseSchemas = routeOptions.schema?.response as Record<number, unknown> | undefined;
  const responseSchema = responseSchemas?.[statusCode] as SchemaWithId | undefined;
  if (!responseSchema) return undefined;

  /* v8 ignore next -- @preserve */
  if (typeof responseSchema === "object") {
    if (responseSchema.$ref) return responseSchema.$ref;
    if (responseSchema.$id) return responseSchema.$id;
  }
  return undefined;
}

/**
 * Schema Discovery Plugin
 *
 * Adds a `Link` header with `rel="describedby"` pointing to the response schema.
 *
 * Only applies to successful responses (< 400 status code).
 * Error responses are handled by the error handler plugin.
 *
 * Response instances are not JSON Schema documents, so they do not receive a `$schema` property.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8288.html
 */
const schemaDiscoveryPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onSend", async (request, reply, payload) => {
    if (reply.statusCode >= 400) return payload;

    const schemaName = getSchemaName(request, reply.statusCode);
    if (!schemaName) return payload;

    addSchemaLinkHeader(reply, schemaName);
    return payload;
  });
};

export default fp(schemaDiscoveryPlugin, {
  fastify: "5.x",
  name: "@app/schema-discovery",
});
