import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type, TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import schemaDiscovery from "../../../src/plugins/schema-discovery.js";

function buildServer() {
  return Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
}

describe("Schema discovery plugin", () => {
  it("adds a describedBy Link without changing the response instance", async () => {
    const fastify = buildServer();
    fastify.register(schemaDiscovery);
    const ResponseSchema = Type.Object({ message: Type.String() }, { $id: "TestResponse" });
    fastify.get("/test", { schema: { response: { 200: ResponseSchema } } }, async () => ({ message: "hello" }));

    const response = await fastify.inject({ method: "GET", url: "/test" });

    expect(response.statusCode).toBe(200);
    expect(response.headers.link).toBe('</schemas/TestResponse.json>; rel="describedBy"');
    expect(response.json()).toEqual({ message: "hello" });
    await fastify.close();
  });

  it("does not add a Link when the response schema has no identifier", async () => {
    const fastify = buildServer();
    fastify.register(schemaDiscovery);
    fastify.get("/test", { schema: { response: { 200: Type.Object({ message: Type.String() }) } } }, async () => ({
      message: "hello",
    }));

    const response = await fastify.inject({ method: "GET", url: "/test" });

    expect(response.headers.link).toBeUndefined();
    await fastify.close();
  });

  it("does not add a success-schema Link to an error response", async () => {
    const fastify = buildServer();
    fastify.register(schemaDiscovery);
    const ResponseSchema = Type.Object({ message: Type.String() }, { $id: "SuccessResponse" });
    fastify.get("/test", { schema: { response: { 200: ResponseSchema } } }, async () => {
      throw new Error("failed");
    });

    const response = await fastify.inject({ method: "GET", url: "/test" });

    expect(response.statusCode).toBe(500);
    expect(response.headers.link).toBeUndefined();
    await fastify.close();
  });

  it("adds discovery metadata for a bodyless modeled response", async () => {
    const fastify = buildServer();
    fastify.register(schemaDiscovery);
    const ResponseSchema = Type.Null({ $id: "EmptyResponse" });
    fastify.get("/test", { schema: { response: { 204: ResponseSchema } } }, async (_request, reply) =>
      reply.code(204).send(null),
    );

    const response = await fastify.inject({ method: "GET", url: "/test" });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(response.headers.link).toBe('</schemas/EmptyResponse.json>; rel="describedBy"');
    await fastify.close();
  });
});
