import type { FastifyRequest } from "fastify";

/**
 * Builds a full URL for a JSON schema endpoint.
 *
 * Uses `x-forwarded-proto` header for protocol detection behind proxies,
 * falling back to the request protocol. Host is determined from the `host`
 * header or request hostname.
 *
 * @param request - Fastify request object
 * @param schemaName - Name of the schema (without .json extension)
 * @returns Full URL to the schema endpoint (e.g., "https://api.example.com/schemas/MySchema.json")
 */
export function buildSchemaUrl(request: FastifyRequest, schemaName: string): string {
  const protocol = (request.headers["x-forwarded-proto"] as string) || request.protocol;
  const host = request.headers.host || request.hostname;
  return `${protocol}://${host}/schemas/${schemaName}.json`;
}
