import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import sensible from "../../../src/plugins/sensible.js";

describe("sensible plugin policy", () => {
  it("registers the shared error schema under the configured identifier", async () => {
    const app = Fastify();
    app.register(sensible);
    await app.ready();

    expect(app.getSchema("HttpError")).toMatchObject({
      $id: "HttpError",
      type: "object",
    });

    await app.close();
  });

  it("makes the error constructor used by application plugins available", async () => {
    const app = Fastify();
    app.register(sensible);
    app.get("/test", async () => {
      throw app.httpErrors.badRequest("invalid application input");
    });

    const response = await app.inject({ method: "GET", url: "/test" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "invalid application input" });
    await app.close();
  });
});
