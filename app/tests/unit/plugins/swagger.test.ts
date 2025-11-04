import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import swagger from "../../../src/plugins/swagger.js";
import health from "../../../src/routes/health.js";

describe("Swagger Documentation", () => {
	it("should serve OpenAPI JSON documentation", async () => {
		const fastify = Fastify();

		await fastify.register(swagger);
		await fastify.register(health);

		const response = await fastify.inject({
			method: "GET",
			url: "/documentation/json",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toContain("application/json");

		const spec = JSON.parse(response.payload);
		expect(spec.openapi).toBe("3.1.0");
		expect(spec.info.title).toBe("Fastify Playground API");
		expect(spec.info.version).toBe("1.0.0");

		await fastify.close();
	});

	it("should serve OpenAPI YAML documentation", async () => {
		const fastify = Fastify();

		await fastify.register(swagger);
		await fastify.register(health);

		const response = await fastify.inject({
			method: "GET",
			url: "/documentation/yaml",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toContain("application/x-yaml");
		expect(response.payload).toContain("openapi: 3.1.0");
		expect(response.payload).toContain("title: Fastify Playground API");

		await fastify.close();
	});

	it("should serve Swagger UI HTML", async () => {
		const fastify = Fastify();

		await fastify.register(swagger);
		await fastify.register(health);

		const response = await fastify.inject({
			method: "GET",
			url: "/documentation",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toContain("text/html");
		expect(response.payload).toContain("Swagger UI");

		await fastify.close();
	});

	it("should document /health endpoint in OpenAPI spec", async () => {
		const fastify = Fastify();

		await fastify.register(swagger);
		await fastify.register(health);
		await fastify.ready(); // Ensure all routes are registered

		const response = await fastify.inject({
			method: "GET",
			url: "/documentation/json",
		});

		const spec = JSON.parse(response.payload);

		// Check that /health endpoint is documented
		expect(spec.paths).toBeDefined();
		expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
		expect(spec.paths).toHaveProperty("/health");
		expect(spec.paths["/health"]).toHaveProperty("get");

		const healthEndpoint = spec.paths["/health"].get;
		expect(healthEndpoint.summary).toBe("Health check endpoint");
		expect(healthEndpoint.description).toBe("Check the health status of the API");
		expect(healthEndpoint.tags).toContain("health");

		// Check response schema
		expect(healthEndpoint.responses).toHaveProperty("200");
		const successResponse = healthEndpoint.responses["200"];
		expect(successResponse.description).toBe("Successful response indicating the API is healthy");

		const responseSchema = successResponse.content["application/json"].schema;
		expect(responseSchema.type).toBe("object");
		expect(responseSchema.properties).toHaveProperty("status");
		expect(responseSchema.properties.status.type).toBe("string");
		expect(responseSchema.properties.status.enum).toContain("healthy");
		expect(responseSchema.required).toContain("status");

		await fastify.close();
	});
});
