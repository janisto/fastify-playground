import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import errorHandler from "../../../src/plugins/error-handler.js";

describe("Error Handler Plugin", () => {
	it("should handle server errors (500+) with proper logging", async () => {
		const fastify = Fastify();
		await fastify.register(errorHandler);

		fastify.get("/error", async () => {
			throw new Error("Internal server error");
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/error",
		});

		expect(response.statusCode).toBe(500);
		const body = JSON.parse(response.payload);
		expect(body.error).toBeDefined();
		expect(body.error.message).toBe("Internal server error");
		expect(body.error.statusCode).toBe(500);

		await fastify.close();
	});

	it("should handle client errors (400+) with proper status code", async () => {
		const fastify = Fastify();
		await fastify.register(errorHandler);

		fastify.get("/client-error", async (_request, reply) => {
			const error = new Error("Bad request") as Error & { statusCode?: number };
			error.statusCode = 400;
			throw error;
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/client-error",
		});

		expect(response.statusCode).toBe(400);
		const body = JSON.parse(response.payload);
		expect(body.error.message).toBe("Bad request");
		expect(body.error.statusCode).toBe(400);

		await fastify.close();
	});

	it("should handle validation errors with 422 status code", async () => {
		const fastify = Fastify();
		await fastify.register(errorHandler);

		fastify.get(
			"/validate",
			{
				schema: {
					querystring: {
						type: "object",
						required: ["name"],
						properties: {
							name: { type: "string" },
						},
					},
				},
			},
			async () => ({ success: true }),
		);

		const response = await fastify.inject({
			method: "GET",
			url: "/validate",
		});

		expect(response.statusCode).toBe(422);
		const body = JSON.parse(response.payload);
		expect(body.error.message).toBe("Validation failed");
		expect(body.error.statusCode).toBe(422);
		expect(body.error.validation).toBeDefined();

		await fastify.close();
	});

	it("should include stack traces in development", async () => {
		const originalEnv = process.env.NODE_ENV;
		delete process.env.NODE_ENV;

		const fastify = Fastify();
		await fastify.register(errorHandler);

		fastify.get("/dev-error", async () => {
			throw new Error("Development error");
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/dev-error",
		});

		const body = JSON.parse(response.payload);
		expect(body.error.stack).toBeDefined();

		process.env.NODE_ENV = originalEnv;
		await fastify.close();
	});

	it("should not include stack traces in production", async () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		const fastify = Fastify();
		await fastify.register(errorHandler);

		fastify.get("/prod-error", async () => {
			throw new Error("Production error");
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/prod-error",
		});

		const body = JSON.parse(response.payload);
		expect(body.error.stack).toBeUndefined();

		process.env.NODE_ENV = originalEnv;
		await fastify.close();
	});

	it("should handle errors with custom error codes", async () => {
		const fastify = Fastify();
		await fastify.register(errorHandler);

		fastify.get("/custom-error", async () => {
			const error = new Error("Custom error") as Error & { code?: string; statusCode?: number };
			error.code = "CUSTOM_ERROR_CODE";
			error.statusCode = 403;
			throw error;
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/custom-error",
		});

		expect(response.statusCode).toBe(403);
		const body = JSON.parse(response.payload);
		expect(body.error.code).toBe("CUSTOM_ERROR_CODE");
		expect(body.error.statusCode).toBe(403);

		await fastify.close();
	});

	it("should default to 500 for errors without status code", async () => {
		const fastify = Fastify();
		await fastify.register(errorHandler);

		fastify.get("/no-status", async () => {
			throw new Error("No status code");
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/no-status",
		});

		expect(response.statusCode).toBe(500);
		const body = JSON.parse(response.payload);
		expect(body.error.statusCode).toBe(500);

		await fastify.close();
	});
});
