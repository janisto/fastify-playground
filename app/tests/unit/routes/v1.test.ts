import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import errorHandler from "../../../src/plugins/error-handler.js";
import sensible from "../../../src/plugins/sensible.js";
import v1Routes from "../../../src/routes/v1.js";

describe("v1 routes", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler);
    fastify.decorate("authenticate", async () => undefined);
    fastify.register(sensible);
    fastify.register(errorHandler);
    fastify.register(v1Routes, { prefix: "/v1" });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it("registers hello routes under /v1/hello", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/v1/hello",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: "Hello, World!" });
  });

  it("registers items routes under /v1/items", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/v1/items",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 30 });
    expect(response.json().items).toHaveLength(20);
  });

  it("returns 404 for unknown v1 routes", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/v1/unknown",
    });

    expect(response.statusCode).toBe(404);
  });
});
