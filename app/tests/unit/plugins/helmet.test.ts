import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import helmet from "../../../src/plugins/helmet.js";

describe("HTTP security headers", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function request(hsts = false) {
    const app = Fastify();
    apps.push(app);
    app.register(helmet, { hsts });
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

  it("omits HSTS for local HTTP development", async () => {
    const response = await request();

    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  it("enables HSTS for the production application configuration", async () => {
    const response = await request(true);

    expect(response.headers["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
  });
});
