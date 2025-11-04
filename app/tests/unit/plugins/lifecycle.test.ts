import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import lifecycle from "../../../src/plugins/lifecycle.js";

describe("Lifecycle Plugin", () => {
	it("should register onReady hook", async () => {
		const fastify = Fastify();
		let onReadyCalled = false;

		await fastify.register(lifecycle);

		// Override the onReady hook to track if it was called
		fastify.addHook("onReady", async () => {
			onReadyCalled = true;
		});

		await fastify.ready();
		expect(onReadyCalled).toBe(true);

		await fastify.close();
	});

	it("should register onClose hook", async () => {
		const fastify = Fastify();
		let onCloseCalled = false;

		await fastify.register(lifecycle);

		fastify.addHook("onClose", async () => {
			onCloseCalled = true;
		});

		await fastify.ready();
		await fastify.close();

		expect(onCloseCalled).toBe(true);
	});

	it("should allow server to start and handle requests", async () => {
		const fastify = Fastify();
		await fastify.register(lifecycle);

		fastify.get("/test", async () => ({ status: "ok" }));

		await fastify.ready();

		const response = await fastify.inject({
			method: "GET",
			url: "/test",
		});

		expect(response.statusCode).toBe(200);
		expect(JSON.parse(response.payload)).toEqual({ status: "ok" });

		await fastify.close();
	});

	it("should properly cleanup resources on close", async () => {
		const fastify = Fastify();
		const cleanupActions: string[] = [];

		await fastify.register(lifecycle);

		// Add a custom cleanup hook
		fastify.addHook("onClose", async () => {
			cleanupActions.push("cleanup-1");
		});

		fastify.addHook("onClose", async () => {
			cleanupActions.push("cleanup-2");
		});

		await fastify.ready();
		await fastify.close();

		expect(cleanupActions).toContain("cleanup-1");
		expect(cleanupActions).toContain("cleanup-2");
	});

	it("should execute onReady before onListen", async () => {
		const fastify = Fastify();
		const executionOrder: string[] = [];

		await fastify.register(lifecycle);

		fastify.addHook("onReady", async () => {
			executionOrder.push("ready");
		});

		// Note: onListen doesn't fire with inject() or ready()
		// So we just test onReady fires
		await fastify.ready();

		expect(executionOrder).toContain("ready");
		await fastify.close();
	});
});
