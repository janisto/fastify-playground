import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schemaRegistry from "../../../src/plugins/schema-registry.js";

describe("schema-registry plugin", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it("registers without errors", async () => {
    await fastify.register(schemaRegistry);
    await fastify.ready();

    expect(fastify).toBeDefined();
  });

  it("registers ErrorModelSchema", async () => {
    await fastify.register(schemaRegistry);
    await fastify.ready();

    const schema = fastify.getSchema("ErrorModel");
    expect(schema).toBeDefined();
    expect(schema).toHaveProperty("$id", "ErrorModel");
  });

  it("ErrorModelSchema has required properties", async () => {
    await fastify.register(schemaRegistry);
    await fastify.ready();

    const schema = fastify.getSchema("ErrorModel") as Record<string, unknown>;
    expect(schema).toBeDefined();
    expect(schema.type).toBe("object");
    expect(schema.properties).toBeDefined();

    const properties = schema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty("$schema");
    expect(properties).toHaveProperty("title");
    expect(properties).toHaveProperty("status");
    expect(properties).toHaveProperty("detail");
  });
});
