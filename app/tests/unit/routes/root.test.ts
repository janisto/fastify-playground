import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import root from "../../../src/routes/root.js";

describe("GET /", () => {
	it("should return root response", async () => {
		const fastify = Fastify();
		await fastify.register(root);

		const response = await fastify.inject({
			method: "GET",
			url: "/",
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body).toEqual({ root: true });

		await fastify.close();
	});
});
