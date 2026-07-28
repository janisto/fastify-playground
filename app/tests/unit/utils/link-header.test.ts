import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { addSchemaLinkHeader } from "../../../src/utils/link-header.js";

describe("addSchemaLinkHeader", () => {
  it("adds Link header with describedby relation", async () => {
    const fastify = Fastify();

    fastify.get("/test", async (_request, reply) => {
      addSchemaLinkHeader(reply, "TestSchema");
      return { ok: true };
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.link).toBe('</schemas/TestSchema.json>; rel="describedby"');

    await fastify.close();
  });

  it("appends to existing Link header", async () => {
    const fastify = Fastify();

    fastify.get("/test", async (_request, reply) => {
      reply.header("Link", '</other>; rel="other"');
      addSchemaLinkHeader(reply, "TestSchema");
      return { ok: true };
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
    const linkHeaders = response.headers.link;
    expect(linkHeaders).toContain('</other>; rel="other"');
    expect(linkHeaders).toContain('</schemas/TestSchema.json>; rel="describedby"');

    await fastify.close();
  });

  it("handles array of existing Link headers", async () => {
    const fastify = Fastify();

    fastify.get("/test", async (_request, reply) => {
      reply.header("Link", ['</first>; rel="first"', '</second>; rel="second"']);
      addSchemaLinkHeader(reply, "TestSchema");
      return { ok: true };
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
    const linkHeaders = response.headers.link;
    expect(linkHeaders).toContain('</first>; rel="first"');
    expect(linkHeaders).toContain('</second>; rel="second"');
    expect(linkHeaders).toContain('</schemas/TestSchema.json>; rel="describedby"');

    await fastify.close();
  });

  it("uses correct schema name in URL", async () => {
    const fastify = Fastify();

    fastify.get("/test", async (_request, reply) => {
      addSchemaLinkHeader(reply, "ErrorModel");
      return { ok: true };
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.link).toBe('</schemas/ErrorModel.json>; rel="describedby"');

    await fastify.close();
  });
});
