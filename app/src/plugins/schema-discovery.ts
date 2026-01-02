import { Buffer } from "node:buffer";
import { decode as cborDecode, encode as cborEncode } from "cbor2";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest, RouteOptions } from "fastify";
import fp from "fastify-plugin";
import { isCborContentType } from "../utils/cbor.js";
import { addSchemaLinkHeader } from "../utils/link-header.js";
import { buildSchemaUrl } from "../utils/schema-url.js";

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

function checkCborContentType(reply: FastifyReply): boolean {
  const contentType = reply.getHeader("content-type");
  /* v8 ignore next -- @preserve */
  const ct = typeof contentType === "string" ? contentType : contentType ? String(contentType) : undefined;
  return isCborContentType(ct);
}

/**
 * Schema Discovery Plugin
 *
 * Adds JSON Schema discovery headers and `$schema` field to responses:
 * - Adds `Link` header with `rel="describedBy"` pointing to schema endpoint
 * - Adds `$schema` field to JSON and CBOR response bodies
 *
 * Only applies to successful responses (< 400 status code).
 * Error responses are handled by the error handler plugin.
 *
 * @see https://json-schema.org/draft/2020-12/json-schema-core.html#name-the-schema-keyword
 */
const schemaDiscoveryPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onSend", async (request, reply, payload) => {
    if (reply.statusCode >= 400) return payload;

    const schemaName = getSchemaName(request, reply.statusCode);
    if (!schemaName) return payload;

    addSchemaLinkHeader(reply, schemaName);

    const schemaUrl = buildSchemaUrl(request, schemaName);

    if (Buffer.isBuffer(payload) && checkCborContentType(reply)) {
      try {
        const body = cborDecode(new Uint8Array(payload)) as Record<string, unknown>;
        body.$schema = schemaUrl;
        return Buffer.from(cborEncode(body));
      } catch {
        return payload;
      }
    }

    if (typeof payload === "string") {
      try {
        const body = JSON.parse(payload) as Record<string, unknown>;
        body.$schema = schemaUrl;
        return JSON.stringify(body);
        /* v8 ignore next 2 -- @preserve */
      } catch {
        return payload;
      }
    }

    return payload;
  });
};

export default fp(schemaDiscoveryPlugin, {
  fastify: "5.x",
  name: "@app/schema-discovery",
});
