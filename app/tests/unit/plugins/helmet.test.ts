import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import helmet from "../../../src/plugins/helmet.js";

describe("Helmet Plugin", () => {
  it("should add security headers", async () => {
    const fastify = Fastify();
    await fastify.register(helmet);

    fastify.get("/test", async () => ({ test: true }));

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    await fastify.close();
  });

  it("should set CSP with frame-ancestors directive", async () => {
    const fastify = Fastify();
    await fastify.register(helmet);

    fastify.get("/test", async () => ({ test: true }));

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    const csp = response.headers["content-security-policy"] as string;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'none'");

    await fastify.close();
  });

  it("should set CSP frame-ancestors to none", async () => {
    const fastify = Fastify();
    await fastify.register(helmet);

    fastify.get("/test", async () => ({ test: true }));

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    const csp = response.headers["content-security-policy"] as string;
    expect(csp).toContain("frame-ancestors 'none'");

    await fastify.close();
  });

  it("should NOT have HSTS header", async () => {
    const fastify = Fastify();
    await fastify.register(helmet);

    fastify.get("/test", async () => ({ test: true }));

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.headers["strict-transport-security"]).toBeUndefined();

    await fastify.close();
  });

  it("should set X-Frame-Options header", async () => {
    const fastify = Fastify();
    await fastify.register(helmet);

    fastify.get("/test", async () => ({ test: true }));

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.headers["x-frame-options"]).toBeDefined();
    expect(response.headers["x-frame-options"]).toBe("DENY");

    await fastify.close();
  });

  it("should set X-Content-Type-Options to nosniff", async () => {
    const fastify = Fastify();
    await fastify.register(helmet);

    fastify.get("/test", async () => ({ test: true }));

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.headers["x-content-type-options"]).toBe("nosniff");

    await fastify.close();
  });

  it("should apply headers globally to all routes", async () => {
    const fastify = Fastify();
    await fastify.register(helmet);

    fastify.get("/route1", async () => ({ route: 1 }));
    fastify.get("/route2", async () => ({ route: 2 }));

    const response1 = await fastify.inject({
      method: "GET",
      url: "/route1",
    });

    const response2 = await fastify.inject({
      method: "GET",
      url: "/route2",
    });

    // Both routes should have security headers
    expect(response1.headers["content-security-policy"]).toBeDefined();
    expect(response1.headers["x-frame-options"]).toBeDefined();

    expect(response2.headers["content-security-policy"]).toBeDefined();
    expect(response2.headers["x-frame-options"]).toBeDefined();

    await fastify.close();
  });

  it("should set Cross-Origin headers", async () => {
    const fastify = Fastify();
    await fastify.register(helmet);

    fastify.get("/api/test", async () => ({ test: true }));

    const response = await fastify.inject({
      method: "GET",
      url: "/api/test",
    });

    expect(response.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(response.headers["cross-origin-resource-policy"]).toBe("same-origin");

    await fastify.close();
  });

  it("should set Cache-Control and Permissions-Policy headers", async () => {
    const fastify = Fastify();
    await fastify.register(helmet);

    fastify.get("/test", async () => ({ test: true }));

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["permissions-policy"]).toBe(
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    );

    await fastify.close();
  });
});
