import { randomUUID } from "node:crypto";
import requestContext from "@fastify/request-context";
import fp from "fastify-plugin";

/**
 * Request logging and tracking plugin for Fastify.
 *
 * This plugin provides:
 * - Automatic request ID generation (or uses client-provided X-Request-Id header)
 * - Request context storage for the request lifecycle
 * - Automatic response time calculation
 * - Structured request/response logging
 * - Request ID added to all logs via child logger
 *
 * The request ID is:
 * - Generated using UUID v4 if not provided
 * - Attached to request.id
 * - Stored in request context
 * - Added to response headers (X-Request-Id)
 * - Included in all logs for request tracing
 *
 * @see https://github.com/fastify/fastify-request-context
 */
export default fp(
	async (fastify) => {
		// Register request context plugin
		await fastify.register(requestContext);

		// onRequest: Generate/extract request ID
		fastify.addHook("onRequest", async (request, reply) => {
			// Use client-provided request ID or generate a new one
			const requestId = (request.headers["x-request-id"] as string) || randomUUID();

			// Store request ID
			request.id = requestId;

			// Add request ID to response headers
			reply.header("X-Request-Id", requestId);

			// Create child logger with request ID for contextual logging
			request.log = request.log.child({ requestId });

			// Log incoming request
			request.log.info(
				{
					method: request.method,
					url: request.url,
					userAgent: request.headers["user-agent"],
					ip: request.ip,
				},
				"Incoming request",
			);
		});

		// onResponse: Log completed requests with timing
		fastify.addHook("onResponse", async (request, reply) => {
			const responseTime = reply.elapsedTime;

			request.log.info(
				{
					method: request.method,
					url: request.url,
					statusCode: reply.statusCode,
					responseTime,
					contentLength: reply.getHeader("content-length"),
				},
				"Request completed",
			);
		});
	},
	{
		name: "request-logging",
		fastify: "5.x",
	},
);
