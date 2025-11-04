import helmet, { type FastifyHelmetOptions } from "@fastify/helmet";
import fp from "fastify-plugin";

/**
 * Helmet security headers plugin for Fastify.
 *
 * This plugin adds essential security headers to protect against common vulnerabilities:
 * - Content-Security-Policy: Controls resource loading to prevent XSS
 * - Strict-Transport-Security (HSTS): Enforces HTTPS connections
 * - X-Frame-Options: Prevents clickjacking attacks
 * - X-Content-Type-Options: Prevents MIME-type sniffing
 * - X-DNS-Prefetch-Control: Controls DNS prefetching
 *
 * Configuration:
 * - CSP allows 'self' for scripts, styles with inline styles for UI frameworks
 * - HSTS with 1-year max-age, includeSubDomains, and preload
 * - Applied globally to all routes
 *
 * @see https://helmetjs.github.io/
 * @see https://github.com/fastify/fastify-helmet
 */
export default fp<FastifyHelmetOptions>(
	async (fastify) => {
		await fastify.register(helmet, {
			global: true,
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					styleSrc: ["'self'", "'unsafe-inline'"],
					scriptSrc: ["'self'"],
					imgSrc: ["'self'", "data:", "https:"],
				},
			},
			hsts: {
				maxAge: 31536000, // 1 year
				includeSubDomains: true,
				preload: true,
			},
		});
	},
	{
		name: "helmet",
		fastify: "5.x",
	},
);
