import cors, { type FastifyCorsOptions } from "@fastify/cors";
import fp from "fastify-plugin";

/**
 * CORS (Cross-Origin Resource Sharing) plugin for Fastify.
 *
 * This plugin configures CORS to:
 * - Allow requests from localhost and 127.0.0.1 (development)
 * - Allow requests with no origin (mobile apps, Postman, curl)
 * - Block all other origins (production security)
 * - Enable credentials (cookies, authorization headers)
 *
 * Security considerations:
 * - In production, maintain an explicit allowlist of trusted origins
 * - Never use wildcard (*) with credentials enabled
 * - Validate origin against your domain whitelist
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
 * @see https://github.com/fastify/fastify-cors
 */
export default fp<FastifyCorsOptions>(
	async (fastify) => {
		await fastify.register(cors, {
			origin: (origin, callback) => {
				// Allow requests with no origin (mobile apps, Postman, etc.)
				if (!origin) {
					callback(null, true);
					return;
				}

				// Allow localhost in development
				const hostname = new URL(origin).hostname;
				if (hostname === "localhost" || hostname === "127.0.0.1") {
					callback(null, true);
					return;
				}

				// In production, you should maintain an allowlist
				// For now, deny all other origins
				callback(new Error("Not allowed by CORS"), false);
			},
			credentials: true,
		});
	},
	{
		name: "cors",
		fastify: "5.x",
	},
);
