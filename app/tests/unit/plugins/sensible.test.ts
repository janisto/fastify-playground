import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import sensible from "../../../src/plugins/sensible.js";

describe("Sensible Plugin", () => {
	describe("HTTP Error Utilities on Reply", () => {
		it("should provide badRequest method", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (_request, reply) => {
				return reply.badRequest("Invalid input");
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(400);
			const body = response.json();
			expect(body.message).toBe("Invalid input");

			await fastify.close();
		});

		it("should provide notFound method", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (_request, reply) => {
				return reply.notFound("Resource not found");
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(404);
			const body = response.json();
			expect(body.message).toBe("Resource not found");

			await fastify.close();
		});

		it("should provide unauthorized method", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (_request, reply) => {
				return reply.unauthorized("Authentication required");
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(401);
			const body = response.json();
			expect(body.message).toBe("Authentication required");

			await fastify.close();
		});

		it("should provide forbidden method", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (_request, reply) => {
				return reply.forbidden("Access denied");
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(403);
			const body = response.json();
			expect(body.message).toBe("Access denied");

			await fastify.close();
		});

		it("should provide conflict method", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (_request, reply) => {
				return reply.conflict("Resource already exists");
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(409);
			const body = response.json();
			expect(body.message).toBe("Resource already exists");

			await fastify.close();
		});

		it("should provide internalServerError method", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (_request, reply) => {
				return reply.internalServerError("Server error occurred");
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(500);
			const body = response.json();
			expect(body.message).toBe("Server error occurred");

			await fastify.close();
		});

		it("should provide serviceUnavailable method", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (_request, reply) => {
				return reply.serviceUnavailable("Service temporarily unavailable");
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(503);
			const body = response.json();
			expect(body.message).toBe("Service temporarily unavailable");

			await fastify.close();
		});
	});

	describe("HTTP Error Constructors (fastify.httpErrors)", () => {
		it("should provide httpErrors object", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			expect(fastify.httpErrors).toBeDefined();
			expect(typeof fastify.httpErrors).toBe("object");

			await fastify.close();
		});

		it("should provide badRequest constructor", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async () => {
				throw fastify.httpErrors.badRequest("Bad request error");
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(400);
			const body = response.json();
			expect(body.message).toBe("Bad request error");

			await fastify.close();
		});

		it("should provide notFound constructor", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async () => {
				throw fastify.httpErrors.notFound("Not found error");
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(404);
			const body = response.json();
			expect(body.message).toBe("Not found error");

			await fastify.close();
		});

		it("should provide createError for custom status codes", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async () => {
				throw fastify.httpErrors.createError(418, "I'm a teapot");
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(418);
			const body = response.json();
			expect(body.message).toBe("I'm a teapot");

			await fastify.close();
		});
	});

	describe("fastify.assert", () => {
		it("should not throw when condition is true", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (request) => {
				const hasAuth: boolean = Boolean(request.headers.authorization);
				fastify.assert(hasAuth, 401, "Missing authorization");
				return { success: true };
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
				headers: {
					authorization: "Bearer token",
				},
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual({ success: true });

			await fastify.close();
		});

		it("should throw with custom status code when condition is false", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (request) => {
				const hasAuth: boolean = Boolean(request.headers.authorization);
				fastify.assert(hasAuth, 401, "Missing authorization");
				return { success: true };
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
				// No authorization header
			});

			expect(response.statusCode).toBe(401);
			const body = response.json();
			expect(body.message).toBe("Missing authorization");

			await fastify.close();
		});

		it("should use default 500 status when no status code provided", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get<{ Querystring: { valid?: string } }>("/test", async (request) => {
				const isValid: boolean = request.query.valid === "true";
				fastify.assert(isValid, "Invalid query parameter");
				return { success: true };
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test?valid=false",
			});

			expect(response.statusCode).toBe(500);

			await fastify.close();
		});
	});

	describe("request.forwarded", () => {
		it("should provide forwarded method on request", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (request) => {
				const forwarded = request.forwarded();
				return { forwarded };
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.forwarded).toBeDefined();

			await fastify.close();
		});
	});

	describe("request.is", () => {
		it("should check content-type with is method", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.post("/test", async (request) => {
				const isJson = request.is(["json"]);
				return { isJson };
			});

			const response = await fastify.inject({
				method: "POST",
				url: "/test",
				headers: {
					"content-type": "application/json",
				},
				payload: { test: true },
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.isJson).toBe("json");

			await fastify.close();
		});
	});

	describe("reply.vary", () => {
		it("should set Vary header", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (_request, reply) => {
				reply.vary("Accept");
				return { success: true };
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers.vary).toBe("Accept");

			await fastify.close();
		});

		it("should add multiple fields to Vary header", async () => {
			const fastify = Fastify();
			await fastify.register(sensible);

			fastify.get("/test", async (_request, reply) => {
				reply.vary("Accept");
				reply.vary("Accept-Encoding");
				return { success: true };
			});

			const response = await fastify.inject({
				method: "GET",
				url: "/test",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers.vary).toContain("Accept");
			expect(response.headers.vary).toContain("Accept-Encoding");

			await fastify.close();
		});
	});
});
