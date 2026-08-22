import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import helmet from "../../../src/plugins/helmet.js";

describe("HTTP security headers", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function request() {
    const app = Fastify();
    apps.push(app);
    app.register(helmet);
    app.get("/resource", async () => ({ ok: true }));
    return app.inject({ method: "GET", url: "/resource" });
  }

  it("applies the complete API response policy", async () => {
    const response = await request();

    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none';frame-ancestors 'none'",
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-resource-policy": "same-origin",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });
    expect(response.headers["permissions-policy"]).toBe(
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    );
  });

  it("leaves HSTS to the TLS-terminating deployment boundary", async () => {
    const response = await request();

    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });
});
