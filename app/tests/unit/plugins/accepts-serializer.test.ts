import { decode } from "cbor2";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import acceptsSerializer from "../../../src/plugins/accepts-serializer.js";

describe("Accepts Serializer Plugin", () => {
  describe("Plugin Registration", () => {
    it("should register the plugin successfully", async () => {
      const fastify = Fastify();
      await fastify.register(acceptsSerializer);
      await fastify.ready();
      await fastify.close();
    });
  });

  describe("JSON Response", () => {
    it("should return JSON with Accept: application/json", async () => {
      const fastify = Fastify();
      await fastify.register(acceptsSerializer);

      fastify.get("/test", async () => {
        return { message: "hello", count: 42 };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          accept: "application/json",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toEqual({ message: "hello", count: 42 });

      await fastify.close();
    });

    it("should default to JSON with unknown Accept header", async () => {
      const fastify = Fastify();
      await fastify.register(acceptsSerializer);

      fastify.get("/test", async () => {
        return { message: "default json" };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          accept: "text/html",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toEqual({ message: "default json" });

      await fastify.close();
    });

    it("should return JSON with no Accept header", async () => {
      const fastify = Fastify();
      await fastify.register(acceptsSerializer);

      fastify.get("/test", async () => {
        return { message: "no accept header" };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.json()).toEqual({ message: "no accept header" });

      await fastify.close();
    });
  });

  describe("CBOR Response", () => {
    it("should return CBOR with Accept: application/cbor", async () => {
      const fastify = Fastify();
      await fastify.register(acceptsSerializer);

      const testData = { message: "cbor response", count: 123 };
      fastify.get("/test", async () => {
        return testData;
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          accept: "application/cbor",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("application/cbor");

      const decodedBody = decode(new Uint8Array(response.rawPayload));
      expect(decodedBody).toEqual(testData);

      await fastify.close();
    });

    it("should return CBOR for application/problem+cbor", async () => {
      const fastify = Fastify();
      await fastify.register(acceptsSerializer);

      const testData = { type: "error", status: 400, title: "Bad Request" };
      fastify.get("/test", async () => {
        return testData;
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          accept: "application/problem+cbor",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("application/problem+cbor");

      const decodedBody = decode(new Uint8Array(response.rawPayload));
      expect(decodedBody).toEqual(testData);

      await fastify.close();
    });

    it("should correctly serialize nested objects as CBOR", async () => {
      const fastify = Fastify();
      await fastify.register(acceptsSerializer);

      const testData = {
        level1: {
          level2: {
            value: "nested",
          },
        },
        array: [1, 2, 3],
      };
      fastify.get("/test", async () => {
        return testData;
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          accept: "application/cbor",
        },
      });

      expect(response.statusCode).toBe(200);

      const decodedBody = decode(new Uint8Array(response.rawPayload));
      expect(decodedBody).toEqual(testData);

      await fastify.close();
    });
  });

  describe("Content Negotiation Priority", () => {
    it("should prefer CBOR when both JSON and CBOR accepted with equal quality", async () => {
      const fastify = Fastify();
      await fastify.register(acceptsSerializer);

      fastify.get("/test", async () => {
        return { data: "test" };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          accept: "application/cbor, application/json",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("application/cbor");

      await fastify.close();
    });

    it("should respect accept header preference order", async () => {
      const fastify = Fastify();
      await fastify.register(acceptsSerializer);

      fastify.get("/test", async () => {
        return { data: "test" };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          accept: "application/json",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");

      await fastify.close();
    });
  });
});
