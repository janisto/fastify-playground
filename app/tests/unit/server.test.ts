import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import lifecycle from "../../src/plugins/lifecycle.js";
import sensible from "../../src/plugins/sensible.js";
import { installSignalHandlers, shutdown } from "../../src/server.js";

describe("server shutdown", () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  const originalExitCode = process.exitCode;

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    process.exitCode = originalExitCode;
  });

  async function build() {
    const app = Fastify({ logger: false });
    apps.push(app);
    app.register(sensible);
    app.register(lifecycle);
    await app.ready();
    return app;
  }

  it("marks the app unavailable before closing it", async () => {
    const app = await build();
    const close = vi.spyOn(app, "close");

    await shutdown(app, "SIGTERM");

    expect(app.isShuttingDown).toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });

  it("coalesces repeated shutdown requests", async () => {
    const cleanup = Promise.withResolvers<void>();
    const close = vi.fn<() => Promise<void>>(() => cleanup.promise);
    const app = {
      isShuttingDown: false,
      log: { error: vi.fn(), info: vi.fn() },
      addHook: vi.fn(),
      close,
    };

    const first = shutdown(app, "SIGTERM");
    const second = shutdown(app, "SIGINT");

    expect(second).toBe(first);
    expect(close).toHaveBeenCalledOnce();
    const secondSettled = vi.fn();
    void second.then(secondSettled);
    await Promise.resolve();
    expect(secondSettled).not.toHaveBeenCalled();

    cleanup.resolve();
    await second;
    expect(secondSettled).toHaveBeenCalledOnce();
  });

  it("sets a failing exit code when resource cleanup rejects", async () => {
    const app = await build();
    vi.spyOn(app, "close").mockRejectedValueOnce(new Error("cleanup canary"));

    await shutdown(app, "SIGTERM");

    expect(process.exitCode).toBe(1);
  });

  it("installs only termination-signal handlers and removes them on close", async () => {
    const app = Fastify({ logger: false });
    apps.push(app);
    app.register(sensible);
    app.register(lifecycle);
    const before = {
      sigint: process.listenerCount("SIGINT"),
      sigterm: process.listenerCount("SIGTERM"),
      uncaughtException: process.listenerCount("uncaughtException"),
      unhandledRejection: process.listenerCount("unhandledRejection"),
    };

    installSignalHandlers(app);
    await app.ready();

    expect(process.listenerCount("SIGINT")).toBe(before.sigint + 1);
    expect(process.listenerCount("SIGTERM")).toBe(before.sigterm + 1);
    expect(process.listenerCount("uncaughtException")).toBe(before.uncaughtException);
    expect(process.listenerCount("unhandledRejection")).toBe(before.unhandledRejection);

    await app.close();
    expect(process.listenerCount("SIGINT")).toBe(before.sigint);
    expect(process.listenerCount("SIGTERM")).toBe(before.sigterm);
  });
});
