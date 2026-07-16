import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import varyHeader from "../../../src/plugins/vary-header.js";

describe("representation cache variance", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function build() {
    const app = Fastify();
    apps.push(app);
    app.register(varyHeader);
    app.route({ method: ["GET", "POST", "PUT", "PATCH", "DELETE"], url: "/resource", handler: async () => ({}) });
    return app;
  }

  it.each(["GET", "POST", "PUT", "PATCH", "DELETE"] as const)(
    "marks %s responses as varying by representation and browser origin",
    async (method) => {
      const response = await build().inject(
        method === "GET" || method === "DELETE"
          ? { method, url: "/resource" }
          : { method, url: "/resource", payload: {} },
      );

      expect(response.statusCode).toBe(200);
      expect(response.headers.vary).toEqual(["Accept", "Origin"]);
    },
  );

  it.each([
    ["handler failure", "/error", 500],
    ["unknown route", "/missing", 404],
  ])("preserves variance on a %s", async (_case, url, statusCode) => {
    const app = build();
    app.get("/error", async () => {
      throw new Error("failure canary");
    });

    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(statusCode);
    expect(response.headers.vary).toEqual(["Accept", "Origin"]);
  });
});
