import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";

/**
 * JWT authentication plugin for Fastify.
 *
 * This plugin adds JWT authentication capabilities using @fastify/jwt.
 * It provides decorators for signing and verifying tokens.
 *
 * Configuration:
 * - Secret is loaded from JWT_SECRET environment variable
 * - Falls back to a development-only secret if not set
 * - Default token expiration: 1 hour
 * - Algorithm: HS256 (HMAC with SHA-256)
 *
 * Decorators added:
 * - reply.jwtSign: Sign a payload and return a JWT token
 * - request.jwtVerify: Verify and decode a JWT from Authorization header
 * - request.jwtDecode: Decode a JWT without verification
 *
 * Usage:
 * ```typescript
 * // Sign a token
 * const token = await reply.jwtSign({ userId: 123, role: 'admin' });
 *
 * // Verify a token (in route handler)
 * await request.jwtVerify();
 * const { userId, role } = request.user;
 *
 * // Decode without verification
 * const decoded = request.jwtDecode();
 * ```
 *
 * @see https://github.com/fastify/fastify-jwt
 */
export default fastifyPlugin(
	async (fastify) => {
		const secret = process.env.JWT_SECRET || "development-secret-change-in-production";

		// Warn in development if using default secret
		if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "test") {
			fastify.log.warn("JWT_SECRET not set. Using development secret. Set JWT_SECRET in production!");
		}

		await fastify.register(fastifyJwt, {
			secret,
			sign: {
				algorithm: "HS256",
				expiresIn: "1h",
			},
		});

		/**
		 * Authentication decorator for protecting routes.
		 *
		 * Use this decorator in the onRequest hook to require JWT authentication:
		 *
		 * @example
		 * ```typescript
		 * fastify.get('/protected', {
		 *   onRequest: [fastify.authenticate]
		 * }, async (request, reply) => {
		 *   return { user: request.user };
		 * });
		 * ```
		 */
		fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				await request.jwtVerify();
			} catch (_error) {
				reply.code(401).send({
					error: {
						message: "Unauthorized",
						code: "UNAUTHORIZED",
						statusCode: 401,
					},
				});
			}
		});
	},
	{
		name: "jwt-plugin",
		fastify: "5.x",
	},
);
