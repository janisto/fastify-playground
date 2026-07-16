import { decode as cborDecode, encode as cborEncode } from "cbor2";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import cborParser from "../../../src/plugins/cbor-parser.js";
import contentNegotiation from "../../../src/plugins/content-negotiation.js";
import sensible from "../../../src/plugins/sensible.js";
import { API_MEDIA_TYPES, SCHEMA_JSON_MEDIA_TYPE } from "../../../src/utils/content-negotiation.js";

async function buildServer() {
  const fastify = Fastify();
  fastify.register(sensible);
  fastify.register(cborParser);
  fastify.register(contentNegotiation);
  return fastify;
}

describe("Content negotiation plugin", () => {
  it("defaults modeled responses to JSON", async () => {
    const fastify = await buildServer();
    fastify.get(
      "/test",
      {
        schema: {
          produces: API_MEDIA_TYPES,
          response: { 200: { type: "object", properties: { message: { type: "string" } } } },
        },
      },
      async () => ({ message: "hello" }),
    );

    const response = await fastify.inject({ method: "GET", url: "/test" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual({ message: "hello" });
    await fastify.close();
  });

  it("encodes an explicitly preferred response as CBOR after schema serialization", async () => {
    const fastify = await buildServer();
    fastify.get(
      "/test",
      {
        schema: {
          produces: API_MEDIA_TYPES,
          response: { 200: { type: "object", properties: { message: { type: "string" } } } },
        },
      },
      async () => ({ message: "hello", privateValue: "must not leak" }),
    );

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
      headers: { accept: "application/cbor" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/cbor");
    expect(cborDecode(new Uint8Array(response.rawPayload))).toEqual({ message: "hello" });
    await fastify.close();
  });

  it.each([
    ["application/json, application/cbor", "application/json"],
    ["*/*", "application/json"],
    ["application/json; charset=utf-8", "application/json"],
    ["application/json;q=0.4, application/cbor;q=0.8", "application/cbor"],
  ])("selects the server policy for %s", async (accept, expected) => {
    const fastify = await buildServer();
    fastify.get(
      "/test",
      { schema: { produces: API_MEDIA_TYPES, response: { 200: { type: "object" } } } },
      async () => ({}),
    );

    const response = await fastify.inject({ method: "GET", url: "/test", headers: { accept } });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain(expected);
    await fastify.close();
  });

  it("returns 406 before parsing the body or calling the handler", async () => {
    const fastify = await buildServer();
    const handler = vi.fn(async () => ({ message: "created" }));
    fastify.post("/test", { schema: { produces: API_MEDIA_TYPES, response: { 201: { type: "object" } } } }, handler);

    const response = await fastify.inject({
      method: "POST",
      url: "/test",
      headers: { accept: "text/html", "content-type": "application/cbor" },
      payload: Buffer.from(cborEncode({ broken: true })).subarray(0, 1),
    });

    expect(response.statusCode).toBe(406);
    expect(handler).not.toHaveBeenCalled();
    await fastify.close();
  });

  it("strictly negotiates a JSON Schema representation", async () => {
    const fastify = await buildServer();
    fastify.get(
      "/schema",
      { schema: { produces: [SCHEMA_JSON_MEDIA_TYPE], response: { 200: { type: "object" } } } },
      async (_request, reply) => reply.type(SCHEMA_JSON_MEDIA_TYPE).send({ type: "object" }),
    );

    const rejected = await fastify.inject({
      method: "GET",
      url: "/schema",
      headers: { accept: "application/json" },
    });
    const accepted = await fastify.inject({
      method: "GET",
      url: "/schema",
      headers: { accept: "application/*" },
    });

    expect(rejected.statusCode).toBe(406);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.headers["content-type"]).toContain(SCHEMA_JSON_MEDIA_TYPE);
    await fastify.close();
  });

  it("leaves fixed-format routes outside negotiation", async () => {
    const fastify = await buildServer();
    fastify.get("/text", async (_request, reply) => reply.type("text/plain").send("hello"));

    const response = await fastify.inject({
      method: "GET",
      url: "/text",
      headers: { accept: "application/cbor" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    await fastify.close();
  });

  it("does not negotiate a bodyless success response", async () => {
    const fastify = await buildServer();
    const handler = vi.fn(async (_request, reply) => reply.code(204).send());
    fastify.delete("/test", { schema: { produces: API_MEDIA_TYPES, response: { 204: { type: "null" } } } }, handler);

    const response = await fastify.inject({
      method: "DELETE",
      url: "/test",
      headers: { accept: "text/html" },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(handler).toHaveBeenCalledOnce();
    await fastify.close();
  });
});
