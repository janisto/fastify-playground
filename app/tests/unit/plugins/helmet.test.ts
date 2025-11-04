import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import helmet from "../../../src/plugins/helmet.js";

describe("Helmet Plugin", () => {
	it("should add security headers", async () => {
		const fastify = Fastify();
		await fastify.register(helmet);

		fastify.get("/test", async () => ({ test: true }));

		const response = await fastify.inject({
			method: "GET",
			url: "/test",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-security-policy"]).toBeDefined();
		expect(response.headers["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains; preload");
		expect(response.headers["x-content-type-options"]).toBe("nosniff");
		expect(response.headers["x-frame-options"]).toBeDefined();

		await fastify.close();
	});

	it("should set CSP with correct directives", async () => {
		const fastify = Fastify();
		await fastify.register(helmet);

		fastify.get("/test", async () => ({ test: true }));

		const response = await fastify.inject({
			method: "GET",
			url: "/test",
		});

		const csp = response.headers["content-security-policy"] as string;
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("style-src 'self' 'unsafe-inline'");
		expect(csp).toContain("script-src 'self'");
		expect(csp).toContain("img-src 'self' data: https:");

		await fastify.close();
	});

	it("should set HSTS header with correct values", async () => {
		const fastify = Fastify();
		await fastify.register(helmet);

		fastify.get("/test", async () => ({ test: true }));

		const response = await fastify.inject({
			method: "GET",
			url: "/test",
		});

		const hsts = response.headers["strict-transport-security"] as string;
		expect(hsts).toBe("max-age=31536000; includeSubDomains; preload");
		expect(hsts).toContain("max-age=31536000"); // 1 year
		expect(hsts).toContain("includeSubDomains");
		expect(hsts).toContain("preload");

		await fastify.close();
	});

	it("should set X-Frame-Options header", async () => {
		const fastify = Fastify();
		await fastify.register(helmet);

		fastify.get("/test", async () => ({ test: true }));

		const response = await fastify.inject({
			method: "GET",
			url: "/test",
		});

		expect(response.headers["x-frame-options"]).toBeDefined();
		// Helmet sets SAMEORIGIN by default
		expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");

		await fastify.close();
	});

	it("should set X-Content-Type-Options to nosniff", async () => {
		const fastify = Fastify();
		await fastify.register(helmet);

		fastify.get("/test", async () => ({ test: true }));

		const response = await fastify.inject({
			method: "GET",
			url: "/test",
		});

		expect(response.headers["x-content-type-options"]).toBe("nosniff");

		await fastify.close();
	});

	it("should apply headers globally to all routes", async () => {
		const fastify = Fastify();
		await fastify.register(helmet);

		fastify.get("/route1", async () => ({ route: 1 }));
		fastify.get("/route2", async () => ({ route: 2 }));

		const response1 = await fastify.inject({
			method: "GET",
			url: "/route1",
		});

		const response2 = await fastify.inject({
			method: "GET",
			url: "/route2",
		});

		// Both routes should have security headers
		expect(response1.headers["content-security-policy"]).toBeDefined();
		expect(response1.headers["strict-transport-security"]).toBeDefined();

		expect(response2.headers["content-security-policy"]).toBeDefined();
		expect(response2.headers["strict-transport-security"]).toBeDefined();

		await fastify.close();
	});
});
