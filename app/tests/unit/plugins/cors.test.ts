import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import cors from "../../../src/plugins/cors.js";

describe("CORS Plugin", () => {
	it("should allow localhost origin", async () => {
		const fastify = Fastify();
		await fastify.register(cors);

		const response = await fastify.inject({
			method: "OPTIONS",
			url: "/",
			headers: {
				origin: "http://localhost:3000",
				"access-control-request-method": "GET",
			},
		});

		expect(response.statusCode).toBe(204);
		expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
		expect(response.headers["access-control-allow-credentials"]).toBe("true");

		await fastify.close();
	});

	it("should allow 127.0.0.1 origin", async () => {
		const fastify = Fastify();
		await fastify.register(cors);

		const response = await fastify.inject({
			method: "OPTIONS",
			url: "/",
			headers: {
				origin: "http://127.0.0.1:3000",
				"access-control-request-method": "GET",
			},
		});

		expect(response.statusCode).toBe(204);
		expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:3000");
		expect(response.headers["access-control-allow-credentials"]).toBe("true");

		await fastify.close();
	});

	it("should allow requests with no origin (mobile apps, Postman)", async () => {
		const fastify = Fastify();
		await fastify.register(cors);

		fastify.get("/test", async () => ({ success: true }));

		const response = await fastify.inject({
			method: "GET",
			url: "/test",
			// No origin header
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ success: true });

		await fastify.close();
	});

	it("should set credentials header to true", async () => {
		const fastify = Fastify();
		await fastify.register(cors);

		const response = await fastify.inject({
			method: "OPTIONS",
			url: "/",
			headers: {
				origin: "http://localhost:8080",
				"access-control-request-method": "POST",
			},
		});

		expect(response.statusCode).toBe(204);
		expect(response.headers["access-control-allow-credentials"]).toBe("true");

		await fastify.close();
	});

	it("should reject non-localhost origins", async () => {
		const fastify = Fastify();
		await fastify.register(cors);

		const response = await fastify.inject({
			method: "OPTIONS",
			url: "/",
			headers: {
				origin: "https://evil.com",
				"access-control-request-method": "GET",
			},
		});

		expect(response.statusCode).toBe(500);

		await fastify.close();
	});

	it("should work with actual GET request after preflight", async () => {
		const fastify = Fastify();
		await fastify.register(cors);

		fastify.get("/api/data", async () => ({ data: "test" }));

		const response = await fastify.inject({
			method: "GET",
			url: "/api/data",
			headers: {
				origin: "http://localhost:3000",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
		expect(response.headers["access-control-allow-credentials"]).toBe("true");
		expect(response.json()).toEqual({ data: "test" });

		await fastify.close();
	});
});
