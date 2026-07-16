import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import lifecycle from "../../../src/plugins/lifecycle.js";
import sensible from "../../../src/plugins/sensible.js";

describe("application lifecycle state", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function build() {
    const app = Fastify({ return503OnClosing: false });
    apps.push(app);
    app.register(sensible);
    app.register(lifecycle);
    return app;
  }

  it("rejects new application work during shutdown without invoking its handler", async () => {
    const app = build();
    const handler = vi.fn(async () => ({ accepted: true }));
    app.get("/work", handler);

    const beforeShutdown = await app.inject({ method: "GET", url: "/work" });
    app.isShuttingDown = true;
    const duringShutdown = await app.inject({ method: "GET", url: "/work" });

    expect(beforeShutdown.statusCode).toBe(200);
    expect(duringShutdown.statusCode).toBe(503);
    expect(duringShutdown.headers["retry-after"]).toBe("10");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("allows only routes that explicitly opt in during shutdown", async () => {
    const app = build();
    const handler = vi.fn(async () => ({ status: "healthy" }));
    app.get("/health", { config: { allowDuringShutdown: true } }, handler);
    await app.ready();
    app.isShuttingDown = true;

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "healthy" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("marks the application as shutting down for every close path", async () => {
    const app = build();
    let observedState = false;
    app.addHook("preClose", async () => {
      observedState = app.isShuttingDown;
    });
    await app.ready();

    await app.close();

    expect(observedState).toBe(true);
  });

  it("does not own process-global fatal-error handlers", async () => {
    const before = {
      uncaughtException: process.listenerCount("uncaughtException"),
      unhandledRejection: process.listenerCount("unhandledRejection"),
    };
    const app = build();
    await app.ready();

    expect(process.listenerCount("uncaughtException")).toBe(before.uncaughtException);
    expect(process.listenerCount("unhandledRejection")).toBe(before.unhandledRejection);
  });
});
