import { request as httpRequest } from "node:http";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

// Own the patched cancellation behavior at the real transport boundary.
describe("HTTP handler cancellation", () => {
  it("keeps a fully received request active until the response finishes", async () => {
    const app = Fastify({ handlerTimeout: 1000 });
    let signal: AbortSignal | undefined;
    app.post("/operation", async (request) => {
      signal = request.signal;
      signal.throwIfAborted();
      return { completed: true };
    });
    try {
      const origin = await app.listen({ host: "127.0.0.1", port: 0 });
      const response = await fetch(`${origin}/operation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(1000),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ completed: true });
      expect(signal?.aborted).toBe(false);
    } finally {
      await app.close();
    }
  });

  it("still aborts outstanding work when the handler deadline expires", async () => {
    const app = Fastify({ handlerTimeout: 30 });
    const aborted = Promise.withResolvers<unknown>();
    app.post("/operation", async (request) => {
      request.signal.addEventListener("abort", () => aborted.resolve(request.signal.reason as unknown), { once: true });
      await aborted.promise;
    });
    try {
      const origin = await app.listen({ host: "127.0.0.1", port: 0 });
      const response = await fetch(`${origin}/operation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(1000),
      });
      expect(response.status).toBe(503);
      expect(await aborted.promise).toMatchObject({ code: "FST_ERR_HANDLER_TIMEOUT" });
    } finally {
      await app.close();
    }
  });

  it("cancels outstanding work when the client disconnects after sending its request", async () => {
    const app = Fastify({ handlerTimeout: 1000 });
    const entered = Promise.withResolvers<AbortSignal>();
    const aborted = Promise.withResolvers<unknown>();
    app.get("/operation", async (request) => {
      request.signal.addEventListener("abort", () => aborted.resolve(request.signal.reason as unknown), { once: true });
      entered.resolve(request.signal);
      await aborted.promise;
    });
    const origin = await app.listen({ host: "127.0.0.1", port: 0 });
    const client = httpRequest(`${origin}/operation`);
    const closed = Promise.withResolvers<void>();
    let clientError: Error | undefined;
    client.on("error", (error) => {
      clientError = error;
    });
    client.once("close", () => closed.resolve());
    try {
      client.end();
      expect((await entered.promise).aborted).toBe(false);
      client.destroy();
      const reason = await aborted.promise;
      await closed.promise;
      expect(clientError).toHaveProperty("code", "ECONNRESET");
      expect(reason).toMatchObject({ name: "AbortError" });
      expect(reason).not.toHaveProperty("code", "FST_ERR_HANDLER_TIMEOUT");
    } finally {
      client.destroy();
      await app.close();
    }
  });
});
