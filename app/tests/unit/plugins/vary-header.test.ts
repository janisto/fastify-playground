import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import varyHeader from "../../../src/plugins/vary-header.js";

describe("Vary Header Plugin", () => {
  describe("Plugin Registration", () => {
    it("should register the plugin successfully", async () => {
      const fastify = Fastify();
      await fastify.register(varyHeader);
      await fastify.ready();
      await fastify.close();
    });
  });

  describe("Vary Header on Responses", () => {
    it("should add Vary: Accept header to GET responses", async () => {
      const fastify = Fastify();
      await fastify.register(varyHeader);

      fastify.get("/test", async () => {
        return { message: "hello" };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.vary).toEqual(["Accept", "Origin"]);

      await fastify.close();
    });

    it("should add Vary: Accept header to POST responses", async () => {
      const fastify = Fastify();
      await fastify.register(varyHeader);

      fastify.post("/test", async () => {
        return { created: true };
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.vary).toEqual(["Accept", "Origin"]);

      await fastify.close();
    });

    it("should add Vary: Accept header to PUT responses", async () => {
      const fastify = Fastify();
      await fastify.register(varyHeader);

      fastify.put("/test", async () => {
        return { updated: true };
      });

      const response = await fastify.inject({
        method: "PUT",
        url: "/test",
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.vary).toEqual(["Accept", "Origin"]);

      await fastify.close();
    });

    it("should add Vary: Accept header to DELETE responses", async () => {
      const fastify = Fastify();
      await fastify.register(varyHeader);

      fastify.delete("/test", async () => {
        return { deleted: true };
      });

      const response = await fastify.inject({
        method: "DELETE",
        url: "/test",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.vary).toEqual(["Accept", "Origin"]);

      await fastify.close();
    });

    it("should add Vary: Accept header to PATCH responses", async () => {
      const fastify = Fastify();
      await fastify.register(varyHeader);

      fastify.patch("/test", async () => {
        return { patched: true };
      });

      const response = await fastify.inject({
        method: "PATCH",
        url: "/test",
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.vary).toEqual(["Accept", "Origin"]);

      await fastify.close();
    });

    it("should add Vary: Accept header to error responses", async () => {
      const fastify = Fastify();
      await fastify.register(varyHeader);

      fastify.get("/error", async () => {
        throw new Error("Test error");
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/error",
      });

      expect(response.statusCode).toBe(500);
      expect(response.headers.vary).toEqual(["Accept", "Origin"]);

      await fastify.close();
    });

    it("should add Vary: Accept header to 404 responses", async () => {
      const fastify = Fastify();
      await fastify.register(varyHeader);

      const response = await fastify.inject({
        method: "GET",
        url: "/nonexistent",
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers.vary).toEqual(["Accept", "Origin"]);

      await fastify.close();
    });
  });

  describe("Multiple Routes", () => {
    it("should add Vary header to all routes", async () => {
      const fastify = Fastify();
      await fastify.register(varyHeader);

      fastify.get("/route1", async () => ({ route: 1 }));
      fastify.get("/route2", async () => ({ route: 2 }));
      fastify.get("/route3", async () => ({ route: 3 }));

      const responses = await Promise.all([
        fastify.inject({ method: "GET", url: "/route1" }),
        fastify.inject({ method: "GET", url: "/route2" }),
        fastify.inject({ method: "GET", url: "/route3" }),
      ]);

      for (const response of responses) {
        expect(response.headers.vary).toEqual(["Accept", "Origin"]);
      }

      await fastify.close();
    });
  });
});
