import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildSchemaUrl } from "../../../src/utils/schema-url.js";

describe("buildSchemaUrl", () => {
  it("should build schema URL with request protocol and host", async () => {
    const fastify = Fastify();

    fastify.get("/test", async (request) => {
      return { url: buildSchemaUrl(request, "TestSchema") };
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.url).toBe("http://localhost:80/schemas/TestSchema.json");

    await fastify.close();
  });

  it("should use x-forwarded-proto header when present", async () => {
    const fastify = Fastify();

    fastify.get("/test", async (request) => {
      return { url: buildSchemaUrl(request, "TestSchema") };
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
      headers: {
        "x-forwarded-proto": "https",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.url).toBe("https://localhost:80/schemas/TestSchema.json");

    await fastify.close();
  });

  it("should use host header in schema URL", async () => {
    const fastify = Fastify();

    fastify.get("/test", async (request) => {
      return { url: buildSchemaUrl(request, "TestSchema") };
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
      headers: {
        host: "api.example.com",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.url).toBe("http://api.example.com/schemas/TestSchema.json");

    await fastify.close();
  });

  it("should combine x-forwarded-proto and custom host", async () => {
    const fastify = Fastify();

    fastify.get("/test", async (request) => {
      return { url: buildSchemaUrl(request, "MySchema") };
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
      headers: {
        "x-forwarded-proto": "https",
        host: "api.example.com",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.url).toBe("https://api.example.com/schemas/MySchema.json");

    await fastify.close();
  });

  it("should fallback to hostname when host header is missing", () => {
    const mockRequest = {
      headers: {},
      protocol: "http",
      hostname: "fallback.example.com",
    } as unknown as Parameters<typeof buildSchemaUrl>[0];

    const url = buildSchemaUrl(mockRequest, "TestSchema");

    expect(url).toBe("http://fallback.example.com/schemas/TestSchema.json");
  });
});
