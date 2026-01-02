import type { FastifyReply } from "fastify";

/**
 * Adds a Link header with `rel="describedBy"` pointing to a schema endpoint.
 *
 * If a Link header already exists, the new link is appended to the existing value(s).
 * This follows RFC 8288 (Web Linking) for schema discovery.
 *
 * @param reply - Fastify reply object
 * @param schemaName - Name of the schema (e.g., "ErrorModel", "HelloResponse")
 *
 * @example
 * addSchemaLinkHeader(reply, "ErrorModel");
 * // Sets: Link: </schemas/ErrorModel.json>; rel="describedBy"
 */
export function addSchemaLinkHeader(reply: FastifyReply, schemaName: string): void {
  const schemaLink = `</schemas/${schemaName}.json>; rel="describedBy"`;
  const existingLink = reply.getHeader("Link");
  if (existingLink) {
    const links = Array.isArray(existingLink) ? existingLink : [String(existingLink)];
    links.push(schemaLink);
    reply.header("Link", links);
  } else {
    reply.header("Link", schemaLink);
  }
}
