import type { FastifyReply } from "fastify";

export const API_CATALOG_LINK = '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"';
export const OPENAPI_DOCUMENT_LINK = '</openapi.json>; rel="service-desc"; type="application/json"';
export const LLMS_INDEX_LINK = '</llms.txt>; rel="describedby"; type="text/plain"';
export const CONSUMER_DOCUMENTATION_PATHS = new Set(["/.well-known/api-catalog", "/llms.txt", "/llms-full.txt"]);

export function addLinkHeader(reply: FastifyReply, link: string): void {
  const existing = reply.getHeader("Link");
  const links = existing === undefined ? [] : Array.isArray(existing) ? existing : [String(existing)];
  reply.header("Link", existing === undefined ? link : [...links, link]);
}

/**
 * Adds a Link header with `rel="describedby"` pointing to a schema endpoint.
 *
 * If a Link header already exists, the new link is appended to the existing value(s).
 * This follows RFC 8288 (Web Linking) for schema discovery.
 *
 * @param reply - Fastify reply object
 * @param schemaName - Name of the schema (e.g., "ErrorModel", "HelloResponse")
 *
 * @example
 * addSchemaLinkHeader(reply, "ErrorModel");
 * // Sets: Link: </schemas/ErrorModel.json>; rel="describedby"
 */
export function addSchemaLinkHeader(reply: FastifyReply, schemaName: string): void {
  const schemaLink = `</schemas/${schemaName}.json>; rel="describedby"`;
  addLinkHeader(reply, schemaLink);
}
