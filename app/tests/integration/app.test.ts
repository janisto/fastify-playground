import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import app from "../../src/app.js";

describe("App Integration", () => {
	it("should initialize app successfully and register all routes", async () => {
		const fastify = Fastify();
		await fastify.register(app);

		// Verify app is ready without errors
		await fastify.ready();

		// Verify key routes are registered
		const routes = fastify.printRoutes({ commonPrefix: false });
		expect(routes).toContain("/ (GET, HEAD)");
		expect(routes).toContain("health (GET, HEAD)");
		expect(routes).toContain("documentation");

		await fastify.close();
	});

	it("should handle requests to root endpoint", async () => {
		const fastify = Fastify();
		await fastify.register(app);

		const response = await fastify.inject({
			method: "GET",
			url: "/",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ root: true });

		await fastify.close();
	});

	it("should handle requests to health endpoint", async () => {
		const fastify = Fastify();
		await fastify.register(app);

		const response = await fastify.inject({
			method: "GET",
			url: "/health",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toHaveProperty("status", "healthy");

		await fastify.close();
	});

	it("should have security headers from helmet plugin", async () => {
		const fastify = Fastify();
		await fastify.register(app);

		const response = await fastify.inject({
			method: "GET",
			url: "/",
		});

		expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
		expect(response.headers["x-content-type-options"]).toBe("nosniff");
		expect(response.headers["strict-transport-security"]).toBeDefined();

		await fastify.close();
	});

	it("should handle CORS for localhost requests", async () => {
		const fastify = Fastify();
		await fastify.register(app);

		const response = await fastify.inject({
			method: "GET",
			url: "/",
			headers: {
				origin: "http://localhost:3000",
			},
		});

		expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
		expect(response.headers["access-control-allow-credentials"]).toBe("true");

		await fastify.close();
	});
});
