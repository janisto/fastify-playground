import sensible, { type FastifySensibleOptions } from "@fastify/sensible";
import fp from "fastify-plugin";

/**
 * Fastify Sensible plugin - Adds useful HTTP utilities and helpers.
 *
 * This plugin provides:
 * - HTTP error helpers: reply.badRequest(), notFound(), unauthorized(), etc.
 * - HTTP error constructors: fastify.httpErrors.createError()
 * - Assert utility: fastify.assert(condition, statusCode, message)
 * - Request helpers: request.forwarded (IP info), request.is() (content-type check)
 * - Reply helpers: reply.vary() (cache control), reply.getHeader(), reply.hasHeader()
 *
 * Usage examples:
 * ```typescript
 * // Throw HTTP errors
 * return reply.notFound('Resource not found');
 *
 * // Create custom errors
 * throw fastify.httpErrors.createError(418, "I'm a teapot");
 *
 * // Conditional assertions
 * fastify.assert(user.isAdmin, 403, 'Forbidden');
 * ```
 *
 * @see https://github.com/fastify/fastify-sensible
 */
export default fp<FastifySensibleOptions>(async (fastify) => {
	fastify.register(sensible);
});
