import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import health from "../../../src/routes/health.js";

describe("GET /health", () => {
	it("should return healthy status", async () => {
		const fastify = Fastify();

		await fastify.register(health);

		const response = await fastify.inject({
			method: "GET",
			url: "/health",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toContain("application/json");
		expect(JSON.parse(response.payload)).toEqual({ status: "healthy" });

		await fastify.close();
	});
});
