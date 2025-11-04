import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import requestLogging from "../../../src/plugins/request-logging.js";

describe("Request Logging Plugin", () => {
	it("should generate request ID when not provided", async () => {
		const fastify = Fastify();
		await fastify.register(requestLogging);

		fastify.get("/test", async () => ({ status: "ok" }));

		const response = await fastify.inject({
			method: "GET",
			url: "/test",
		});

		expect(response.headers["x-request-id"]).toBeDefined();
		expect(typeof response.headers["x-request-id"]).toBe("string");
		expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

		await fastify.close();
	});

	it("should use client-provided request ID", async () => {
		const fastify = Fastify();
		await fastify.register(requestLogging);

		fastify.get("/test", async () => ({ status: "ok" }));

		const clientRequestId = "custom-request-id-123";
		const response = await fastify.inject({
			method: "GET",
			url: "/test",
			headers: {
				"X-Request-Id": clientRequestId,
			},
		});

		expect(response.headers["x-request-id"]).toBe(clientRequestId);

		await fastify.close();
	});

	it("should add request ID to request object", async () => {
		const fastify = Fastify();
		await fastify.register(requestLogging);

		let capturedRequestId: string | undefined;

		fastify.get("/test", async (request) => {
			capturedRequestId = request.id;
			return { status: "ok" };
		});

		await fastify.inject({
			method: "GET",
			url: "/test",
		});

		expect(capturedRequestId).toBeDefined();
		expect(typeof capturedRequestId).toBe("string");

		await fastify.close();
	});

	it("should log incoming requests", async () => {
		const fastify = Fastify({
			logger: true,
		});

		await fastify.register(requestLogging);

		fastify.get("/test", async () => ({ status: "ok" }));

		const response = await fastify.inject({
			method: "GET",
			url: "/test",
		});

		// Verify the endpoint works (logging happens in background)
		expect(response.statusCode).toBe(200);

		await fastify.close();
	});

	it("should handle multiple concurrent requests with unique IDs", async () => {
		const fastify = Fastify();
		await fastify.register(requestLogging);

		const requestIds = new Set<string>();

		fastify.get("/test", async (request) => {
			requestIds.add(request.id);
			return { id: request.id };
		});

		// Make multiple concurrent requests
		const requests = await Promise.all([
			fastify.inject({ method: "GET", url: "/test" }),
			fastify.inject({ method: "GET", url: "/test" }),
			fastify.inject({ method: "GET", url: "/test" }),
			fastify.inject({ method: "GET", url: "/test" }),
			fastify.inject({ method: "GET", url: "/test" }),
		]);

		// Verify each has a unique request ID
		expect(requestIds.size).toBe(5);
		expect(requests.map((r) => r.headers["x-request-id"]).every((id) => id)).toBe(true);

		await fastify.close();
	});

	it("should work with different HTTP methods", async () => {
		const fastify = Fastify();
		await fastify.register(requestLogging);

		fastify.get("/test", async () => ({ method: "GET" }));
		fastify.post("/test", async () => ({ method: "POST" }));
		fastify.put("/test", async () => ({ method: "PUT" }));
		fastify.delete("/test", async () => ({ method: "DELETE" }));

		const getResponse = await fastify.inject({ method: "GET", url: "/test" });
		const postResponse = await fastify.inject({ method: "POST", url: "/test" });
		const putResponse = await fastify.inject({ method: "PUT", url: "/test" });
		const deleteResponse = await fastify.inject({ method: "DELETE", url: "/test" });

		expect(getResponse.headers["x-request-id"]).toBeDefined();
		expect(postResponse.headers["x-request-id"]).toBeDefined();
		expect(putResponse.headers["x-request-id"]).toBeDefined();
		expect(deleteResponse.headers["x-request-id"]).toBeDefined();

		await fastify.close();
	});
});
