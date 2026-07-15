import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import lifecycle from "../../../src/plugins/lifecycle.js";

describe("application lifecycle state", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("starts ready to serve and can transition to shutting down", async () => {
    const app = Fastify();
    apps.push(app);
    app.register(lifecycle);
    await app.ready();

    expect(app.isShuttingDown).toBe(false);

    app.isShuttingDown = true;
    expect(app.isShuttingDown).toBe(true);
  });

  it("does not own process-global fatal-error handlers", async () => {
    const before = {
      uncaughtException: process.listenerCount("uncaughtException"),
      unhandledRejection: process.listenerCount("unhandledRejection"),
    };
    const app = Fastify();
    apps.push(app);

    app.register(lifecycle);
    await app.ready();

    expect(process.listenerCount("uncaughtException")).toBe(before.uncaughtException);
    expect(process.listenerCount("unhandledRejection")).toBe(before.unhandledRejection);
  });
});
