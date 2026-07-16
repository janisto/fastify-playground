import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import cors from "../../../src/plugins/cors.js";

describe("CORS policy", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function build(origins: readonly string[] = []) {
    const app = Fastify();
    apps.push(app);
    app.register(cors, { origins });
    app.get("/resource", async () => ({ ok: true }));
    return app;
  }

  it("reflects an exact configured origin and enables credentials", async () => {
    const app = build(["https://app.example.com"]);

    const response = await app.inject({
      method: "OPTIONS",
      url: "/resource",
      headers: {
        origin: "https://app.example.com",
        "access-control-request-method": "GET",
        "access-control-request-headers": "traceparent,tracestate",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://app.example.com");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-headers"]).toContain("traceparent");
    expect(response.headers["access-control-allow-headers"]).toContain("tracestate");
  });

  it.each([
    ["unconfigured production origin", "https://evil.example"],
    ["lookalike subdomain", "https://app.example.com.evil.example"],
    ["different port", "https://app.example.com:8443"],
    ["localhost without explicit configuration", "http://localhost:3000"],
    ["malformed origin", "not-an-origin"],
  ])("omits CORS authorization for a %s", async (_case, origin) => {
    const app = build(["https://app.example.com"]);

    const response = await app.inject({
      method: "GET",
      url: "/resource",
      headers: { origin },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("does not block non-browser requests without an Origin header", async () => {
    const response = await build().inject({ method: "GET", url: "/resource" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
