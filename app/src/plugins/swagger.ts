import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

/**
 * OpenAPI/Swagger documentation plugin for Fastify.
 *
 * This plugin provides:
 * - Automatic OpenAPI 3.1.0 specification generation
 * - Interactive Swagger UI at /documentation
 * - JSON spec available at /documentation/json
 * - YAML spec available at /documentation/yaml
 * - JWT Bearer authentication scheme configured
 *
 * The documentation is auto-generated from:
 * - Route schemas defined in route handlers
 * - JSDoc comments on route handlers
 * - Schema definitions in route options
 *
 * Access the documentation at:
 * - UI: http://localhost:3000/documentation
 * - JSON: http://localhost:3000/documentation/json
 * - YAML: http://localhost:3000/documentation/yaml
 *
 * @see https://github.com/fastify/fastify-swagger
 * @see https://github.com/fastify/fastify-swagger-ui
 */
const swaggerPlugin: FastifyPluginAsync = async (fastify): Promise<void> => {
	await fastify.register(fastifySwagger, {
		openapi: {
			openapi: "3.1.0",
			info: {
				title: "Fastify Playground API",
				description: "A REST API built with Fastify and TypeScript",
				version: "1.0.0",
			},
			servers: [
				{
					url: "http://localhost:3000",
					description: "Development server",
				},
			],
			tags: [
				{ name: "health", description: "Health check endpoints" },
				{ name: "user", description: "User management endpoints" },
			],
			components: {
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						bearerFormat: "JWT",
					},
				},
			},
		},
	});

	await fastify.register(fastifySwaggerUi, {
		routePrefix: "/documentation",
		uiConfig: {
			docExpansion: "list",
			deepLinking: true,
		},
		staticCSP: true,
		transformStaticCSP: (header) => header,
	});
};

export default fp(swaggerPlugin, {
	name: "swagger",
	fastify: "5.x",
});
