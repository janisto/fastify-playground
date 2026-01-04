import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import type { FastifyInstance, FastifyServerOptions } from "fastify";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { helloRoutes } from "../../../../src/modules/hello/index.js";

describe("hello routes", () => {
  let fastify: FastifyInstance;

  const createFastify = (opts?: FastifyServerOptions) => {
    return Fastify(opts).setValidatorCompiler(TypeBoxValidatorCompiler);
  };

  beforeEach(async () => {
    fastify = createFastify();
    await fastify.register(helloRoutes);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("GET /", () => {
    it("returns default greeting", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toEqual({ message: "Hello, World!" });
    });
  });

  describe("POST /", () => {
    it("returns personalized greeting with valid name", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: { name: "Alice" },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({ message: "Hello, Alice!" });
    });

    it("returns 422 when name is missing", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 422 when name is empty string", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: { name: "" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("returns 422 when name exceeds max length", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/",
        payload: { name: "a".repeat(101) },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
