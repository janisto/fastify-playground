import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import errorHandler from "../../../src/plugins/error-handler.js";
import sensiblePlugin from "../../../src/plugins/sensible.js";

vi.mock("../../../src/env.js", () => ({
	env: {
		NODE_ENV: "test",
		PORT: 3000,
		HOST: "0.0.0.0",
		LOG_LEVEL: "info",
	},
}));

describe("Error Handler Plugin", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("should handle server errors (500+) with proper logging", async () => {
		const fastify = Fastify();
		await fastify.register(sensiblePlugin);
		await fastify.register(errorHandler);

		fastify.get("/error", async () => {
			throw new Error("Internal server error");
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/error",
		});

		expect(response.statusCode).toBe(500);
		expect(response.headers["x-request-id"]).toBeDefined();
		const body = response.json();
		expect(body.error).toBeDefined();
		expect(body.error.message).toBe("Internal server error");
		expect(body.error.statusCode).toBe(500);

		await fastify.close();
	});

	it("should handle client errors (400+) with proper status code", async () => {
		const fastify = Fastify();
		await fastify.register(sensiblePlugin);
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
		const body = response.json();
		expect(body.error.message).toBe("Bad request");
		expect(body.error.statusCode).toBe(400);

		await fastify.close();
	});

	it("should handle validation errors with 422 status code", async () => {
		const fastify = Fastify();
		await fastify.register(sensiblePlugin);
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
		const body = response.json();
		expect(body.error.message).toBe("Validation failed");
		expect(body.error.statusCode).toBe(422);
		expect(body.error.validation).toBeDefined();

		await fastify.close();
	});

	it("should use VALIDATION_ERROR code when error.code is not set", async () => {
		const fastify = Fastify();
		await fastify.register(sensiblePlugin);
		await fastify.register(errorHandler);

		fastify.get("/validation-no-code", async () => {
			const error = new Error("Custom validation") as Error & {
				validation?: unknown[];
				statusCode?: number;
				code?: string;
			};
			error.validation = [{ message: "field is required" }];
			error.statusCode = 400;
			throw error;
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/validation-no-code",
		});

		expect(response.statusCode).toBe(422);
		const body = response.json();
		expect(body.error.code).toBe("VALIDATION_ERROR");

		await fastify.close();
	});

	it("should include stack traces in development", async () => {
		vi.doMock("../../../src/env.js", () => ({
			env: {
				NODE_ENV: "development",
				PORT: 3000,
				HOST: "0.0.0.0",
				LOG_LEVEL: "info",
			},
		}));

		const { default: errorHandlerDev } = await import("../../../src/plugins/error-handler.js");
		const { default: sensiblePluginDev } = await import("../../../src/plugins/sensible.js");

		const fastify = Fastify();
		await fastify.register(sensiblePluginDev);
		await fastify.register(errorHandlerDev);

		fastify.get("/dev-error", async () => {
			throw new Error("Development error");
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/dev-error",
		});

		const body = response.json();
		expect(body.error.stack).toBeDefined();

		await fastify.close();
	});

	it("should include stack traces in validation errors in development", async () => {
		vi.doMock("../../../src/env.js", () => ({
			env: {
				NODE_ENV: "development",
				PORT: 3000,
				HOST: "0.0.0.0",
				LOG_LEVEL: "info",
			},
		}));

		const { default: errorHandlerDev } = await import("../../../src/plugins/error-handler.js");
		const { default: sensiblePluginDev } = await import("../../../src/plugins/sensible.js");

		const fastify = Fastify();
		await fastify.register(sensiblePluginDev);
		await fastify.register(errorHandlerDev);

		fastify.get(
			"/validate-dev",
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
			url: "/validate-dev",
		});

		expect(response.statusCode).toBe(422);
		const body = response.json();
		expect(body.error.message).toBe("Validation failed");
		expect(body.error.stack).toBeDefined();

		await fastify.close();
	});

	it("should not include stack traces in production", async () => {
		vi.doMock("../../../src/env.js", () => ({
			env: {
				NODE_ENV: "production",
				PORT: 3000,
				HOST: "0.0.0.0",
				LOG_LEVEL: "info",
			},
		}));

		const { default: errorHandlerProd } = await import("../../../src/plugins/error-handler.js");
		const { default: sensiblePluginProd } = await import("../../../src/plugins/sensible.js");

		const fastify = Fastify();
		await fastify.register(sensiblePluginProd);
		await fastify.register(errorHandlerProd);

		fastify.get("/prod-error", async () => {
			throw new Error("Production error");
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/prod-error",
		});

		const body = response.json();
		expect(body.error.stack).toBeUndefined();

		await fastify.close();
	});

	it("should not include stack traces in validation errors in production", async () => {
		vi.doMock("../../../src/env.js", () => ({
			env: {
				NODE_ENV: "production",
				PORT: 3000,
				HOST: "0.0.0.0",
				LOG_LEVEL: "info",
			},
		}));

		const { default: errorHandlerProd } = await import("../../../src/plugins/error-handler.js");
		const { default: sensiblePluginProd } = await import("../../../src/plugins/sensible.js");

		const fastify = Fastify();
		await fastify.register(sensiblePluginProd);
		await fastify.register(errorHandlerProd);

		fastify.get(
			"/validate-prod",
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
			url: "/validate-prod",
		});

		expect(response.statusCode).toBe(422);
		const body = response.json();
		expect(body.error.message).toBe("Validation failed");
		expect(body.error.stack).toBeUndefined();

		await fastify.close();
	});

	it("should handle errors with custom error codes", async () => {
		const fastify = Fastify();
		await fastify.register(sensiblePlugin);
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
		const body = response.json();
		expect(body.error.code).toBe("CUSTOM_ERROR_CODE");
		expect(body.error.statusCode).toBe(403);

		await fastify.close();
	});

	it("should default to 500 for errors without status code", async () => {
		const fastify = Fastify();
		await fastify.register(sensiblePlugin);
		await fastify.register(errorHandler);

		fastify.get("/no-status", async () => {
			throw new Error("No status code");
		});

		const response = await fastify.inject({
			method: "GET",
			url: "/no-status",
		});

		expect(response.statusCode).toBe(500);
		const body = response.json();
		expect(body.error.statusCode).toBe(500);

		await fastify.close();
	});
});
