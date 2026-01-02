import sensible from "@fastify/sensible";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import fp from "fastify-plugin";
import { describe, expect, it } from "vitest";
import helloRoutes from "../../../src/routes/hello.js";

describe("Hello Routes", () => {
  describe("GET /hello", () => {
    it("should return a greeting message", async () => {
      const fastify = Fastify();
      await fastify.register(helloRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/hello",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toEqual({ message: "Hello, World!" });

      await fastify.close();
    });

    it("should register HelloData schema for discovery", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      const { default: schemaRegistry } = await import("../../../src/plugins/schema-registry.js");
      await fastify.register(schemaRegistry);
      await fastify.register(fp(helloRoutes));
      await fastify.ready();

      const schemas = fastify.getSchemas();
      expect(schemas.HelloResponse).toBeDefined();
      const helloResponseSchema = schemas.HelloResponse as { $id?: string };
      expect(helloResponseSchema.$id).toBe("HelloResponse");

      await fastify.close();
    });
  });

  describe("POST /hello", () => {
    it("should return a personalized greeting", async () => {
      const fastify = Fastify();
      await fastify.register(helloRoutes);

      const response = await fastify.inject({
        method: "POST",
        url: "/hello",
        headers: {
          "Content-Type": "application/json",
        },
        payload: { name: "Alice" },
      });

      expect(response.statusCode).toBe(201);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toEqual({ message: "Hello, Alice!" });

      await fastify.close();
    });

    it("should return 201 Created status", async () => {
      const fastify = Fastify();
      await fastify.register(helloRoutes);

      const response = await fastify.inject({
        method: "POST",
        url: "/hello",
        headers: {
          "Content-Type": "application/json",
        },
        payload: { name: "Bob" },
      });

      expect(response.statusCode).toBe(201);

      await fastify.close();
    });

    it("should return 400 for invalid body - missing name", async () => {
      const fastify = Fastify();
      await fastify.register(helloRoutes);

      const response = await fastify.inject({
        method: "POST",
        url: "/hello",
        headers: {
          "Content-Type": "application/json",
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("should return 400 for invalid body - name too short", async () => {
      const fastify = Fastify();
      await fastify.register(helloRoutes);

      const response = await fastify.inject({
        method: "POST",
        url: "/hello",
        headers: {
          "Content-Type": "application/json",
        },
        payload: { name: "" },
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("should return 400 for invalid body - name too long", async () => {
      const fastify = Fastify();
      await fastify.register(helloRoutes);

      const response = await fastify.inject({
        method: "POST",
        url: "/hello",
        headers: {
          "Content-Type": "application/json",
        },
        payload: { name: "A".repeat(101) },
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("should strip additional properties from body", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(helloRoutes);

      const response = await fastify.inject({
        method: "POST",
        url: "/hello",
        headers: {
          "Content-Type": "application/json",
        },
        payload: { name: "Charlie", extra: "field" },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().message).toBe("Hello, Charlie!");

      await fastify.close();
    });
  });
});
