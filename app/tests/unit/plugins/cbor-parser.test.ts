import { encode } from "cbor2";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import cborParser from "../../../src/plugins/cbor-parser.js";

describe("CBOR Parser Plugin", () => {
  describe("Plugin Registration", () => {
    it("should register content type parser for application/cbor", async () => {
      const fastify = Fastify();
      await fastify.register(cborParser);

      fastify.post("/test", async (request) => {
        return { received: request.body };
      });

      const testData = { name: "test", value: 42 };
      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        headers: {
          "content-type": "application/cbor",
        },
        payload: Buffer.from(encode(testData)),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: testData });

      await fastify.close();
    });
  });

  describe("Valid CBOR Parsing", () => {
    it("should parse valid CBOR object", async () => {
      const fastify = Fastify();
      await fastify.register(cborParser);

      fastify.post("/test", async (request) => {
        return { received: request.body };
      });

      const testData = { message: "hello", count: 100 };
      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        headers: {
          "content-type": "application/cbor",
        },
        payload: Buffer.from(encode(testData)),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: testData });

      await fastify.close();
    });

    it("should parse valid CBOR array", async () => {
      const fastify = Fastify();
      await fastify.register(cborParser);

      fastify.post("/test", async (request) => {
        return { received: request.body };
      });

      const testData = [1, 2, 3, "four", { five: 5 }];
      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        headers: {
          "content-type": "application/cbor",
        },
        payload: Buffer.from(encode(testData)),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: testData });

      await fastify.close();
    });

    it("should parse CBOR with nested structures", async () => {
      const fastify = Fastify();
      await fastify.register(cborParser);

      fastify.post("/test", async (request) => {
        return { received: request.body };
      });

      const testData = {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
        array: [{ a: 1 }, { b: 2 }],
      };
      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        headers: {
          "content-type": "application/cbor",
        },
        payload: Buffer.from(encode(testData)),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: testData });

      await fastify.close();
    });
  });

  describe("Empty Body Handling", () => {
    it("should handle empty body and return undefined", async () => {
      const fastify = Fastify();
      await fastify.register(cborParser);

      fastify.post("/test", async (request) => {
        return { received: request.body ?? null };
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        headers: {
          "content-type": "application/cbor",
        },
        payload: Buffer.alloc(0),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: null });

      await fastify.close();
    });
  });

  describe("Invalid CBOR Handling", () => {
    it("should return 400 for invalid CBOR data", async () => {
      const fastify = Fastify();
      await fastify.register(cborParser);

      fastify.post("/test", async (request) => {
        return { received: request.body };
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        headers: {
          "content-type": "application/cbor",
        },
        payload: Buffer.from([0xff, 0xff, 0xff]),
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain("Invalid CBOR");

      await fastify.close();
    });

    it("should return 400 for truncated CBOR data", async () => {
      const fastify = Fastify();
      await fastify.register(cborParser);

      fastify.post("/test", async (request) => {
        return { received: request.body };
      });

      const validCbor = Buffer.from(encode({ test: "data" }));
      const truncatedCbor = validCbor.subarray(0, Math.floor(validCbor.length / 2));

      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        headers: {
          "content-type": "application/cbor",
        },
        payload: truncatedCbor,
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });
  });

  describe("Content-Type Suffix Pattern", () => {
    it("should parse application/*+cbor content types", async () => {
      const fastify = Fastify();
      await fastify.register(cborParser);

      fastify.post("/test", async (request) => {
        return { received: request.body };
      });

      const testData = { custom: "cbor" };
      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        headers: {
          "content-type": "application/vnd.api+cbor",
        },
        payload: Buffer.from(encode(testData)),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: testData });

      await fastify.close();
    });

    it("should parse application/problem+cbor content type", async () => {
      const fastify = Fastify();
      await fastify.register(cborParser);

      fastify.post("/test", async (request) => {
        return { received: request.body };
      });

      const testData = { type: "error", status: 400 };
      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        headers: {
          "content-type": "application/problem+cbor",
        },
        payload: Buffer.from(encode(testData)),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: testData });

      await fastify.close();
    });
  });
});
