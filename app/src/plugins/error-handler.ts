import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

/**
 * Global error handler plugin for Fastify.
 *
 * This plugin sets up a global error handler that:
 * - Logs errors appropriately based on status code (error/warn)
 * - Returns structured error responses with consistent format
 * - Handles validation errors with 422 status code
 * - Includes stack traces in development only
 * - Properly sets status codes (defaults to 500 for unset errors)
 *
 * Error response format:
 * ```json
 * {
 *   "error": {
 *     "message": "Error message",
 *     "code": "ERROR_CODE",
 *     "statusCode": 500,
 *     "stack": "..." // Only in development
 *   }
 * }
 * ```
 *
 * @see https://fastify.dev/docs/latest/Reference/Server/#seterrorhandler
 */
export default fp(
	async (fastify) => {
		fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
			// Determine status code (Fastify automatically sets <400 to 500)
			const statusCode = error.statusCode ?? 500;

			// Log errors based on severity
			if (statusCode >= 500) {
				request.log.error(error, `Server error: ${error.message}`);
			} else if (statusCode >= 400) {
				request.log.warn(error, `Client error: ${error.message}`);
			}

			// Handle validation errors specifically
			if (error.validation) {
				return reply.status(422).send({
					error: {
						message: "Validation failed",
						code: error.code || "VALIDATION_ERROR",
						statusCode: 422,
						validation: error.validation,
						...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
					},
				});
			}

			// Structured error response
			return reply.status(statusCode).send({
				error: {
					message: error.message,
					code: error.code,
					statusCode,
					...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
				},
			});
		});
	},
	{
		name: "error-handler",
		fastify: "5.x",
	},
);
