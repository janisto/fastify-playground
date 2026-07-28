import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import underPressure from "../../../src/plugins/under-pressure.js";
import health from "../../../src/routes/health.js";

describe("under-pressure", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    vi.useRealTimers();
  });

  it("rejects application work under pressure while preserving process liveness", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const app = Fastify();
    apps.push(app);
    const handler = vi.fn(async () => ({ ok: true }));

    await app.register(underPressure, {
      maxEventLoopDelay: 0,
      maxEventLoopUtilization: 0,
      maxHeapUsedBytes: 1,
      sampleInterval: 10,
    });
    await app.register(health);
    app.get("/work", handler);
    await app.ready();
    await vi.advanceTimersByTimeAsync(10);
    expect(app.isUnderPressure()).toBe(true);

    const overloaded = await app.inject({ method: "GET", url: "/work" });
    const liveness = await app.inject({ method: "GET", url: "/health" });

    expect(overloaded.statusCode).toBe(503);
    expect(overloaded.headers["retry-after"]).toBe("10");
    expect(handler).not.toHaveBeenCalled();
    expect(liveness.statusCode).toBe(200);
    expect(liveness.json()).toEqual({ status: "healthy" });
  });
});
