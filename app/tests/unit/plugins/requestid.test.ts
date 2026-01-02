import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import requestid from "../../../src/plugins/requestid.js";

describe("Request ID Plugin", () => {
  it("should generate request ID when not provided", async () => {
    const fastify = Fastify();
    await fastify.register(requestid);

    fastify.get("/test", async () => ({ status: "ok" }));

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.headers["x-request-id"]).toBeDefined();
    expect(typeof response.headers["x-request-id"]).toBe("string");
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await fastify.close();
  });

  it("should use client-provided request ID when valid", async () => {
    const fastify = Fastify();
    await fastify.register(requestid);

    fastify.get("/test", async () => ({ status: "ok" }));

    const clientRequestId = "custom-request-id-123";
    const response = await fastify.inject({
      method: "GET",
      url: "/test",
      headers: {
        "X-Request-Id": clientRequestId,
      },
    });

    expect(response.headers["x-request-id"]).toBe(clientRequestId);

    await fastify.close();
  });

  it("should generate new UUID when request ID is too long", async () => {
    const fastify = Fastify();
    await fastify.register(requestid);

    fastify.get("/test", async () => ({ status: "ok" }));

    const longRequestId = "a".repeat(129);
    const response = await fastify.inject({
      method: "GET",
      url: "/test",
      headers: {
        "X-Request-Id": longRequestId,
      },
    });

    expect(response.headers["x-request-id"]).not.toBe(longRequestId);
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await fastify.close();
  });

  it("should generate new UUID when request ID contains non-ASCII characters", async () => {
    const fastify = Fastify();
    await fastify.register(requestid);

    fastify.get("/test", async () => ({ status: "ok" }));

    const nonAsciiRequestId = "request-id-\u0000-null";
    const response = await fastify.inject({
      method: "GET",
      url: "/test",
      headers: {
        "X-Request-Id": nonAsciiRequestId,
      },
    });

    expect(response.headers["x-request-id"]).not.toBe(nonAsciiRequestId);
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await fastify.close();
  });

  it("should generate new UUID when request ID contains control characters", async () => {
    const fastify = Fastify();
    await fastify.register(requestid);

    fastify.get("/test", async () => ({ status: "ok" }));

    const controlCharRequestId = "request-id-\n-newline";
    const response = await fastify.inject({
      method: "GET",
      url: "/test",
      headers: {
        "X-Request-Id": controlCharRequestId,
      },
    });

    expect(response.headers["x-request-id"]).not.toBe(controlCharRequestId);
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await fastify.close();
  });

  it("should accept request ID at exactly max length (128 chars)", async () => {
    const fastify = Fastify();
    await fastify.register(requestid);

    fastify.get("/test", async () => ({ status: "ok" }));

    const maxLengthRequestId = "a".repeat(128);
    const response = await fastify.inject({
      method: "GET",
      url: "/test",
      headers: {
        "X-Request-Id": maxLengthRequestId,
      },
    });

    expect(response.headers["x-request-id"]).toBe(maxLengthRequestId);

    await fastify.close();
  });

  it("should add request ID to request object", async () => {
    const fastify = Fastify();
    await fastify.register(requestid);

    let capturedRequestId: string | undefined;

    fastify.get("/test", async (request) => {
      capturedRequestId = request.id;
      return { status: "ok" };
    });

    await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(capturedRequestId).toBeDefined();
    expect(typeof capturedRequestId).toBe("string");

    await fastify.close();
  });

  it("should handle multiple concurrent requests with unique IDs", async () => {
    const fastify = Fastify();
    await fastify.register(requestid);

    const requestIds = new Set<string>();

    fastify.get("/test", async (request) => {
      requestIds.add(request.id);
      return { id: request.id };
    });

    const requests = await Promise.all([
      fastify.inject({ method: "GET", url: "/test" }),
      fastify.inject({ method: "GET", url: "/test" }),
      fastify.inject({ method: "GET", url: "/test" }),
      fastify.inject({ method: "GET", url: "/test" }),
      fastify.inject({ method: "GET", url: "/test" }),
    ]);

    expect(requestIds.size).toBe(5);
    expect(requests.map((r) => r.headers["x-request-id"]).every((id) => id)).toBe(true);

    await fastify.close();
  });

  it("should work with different HTTP methods", async () => {
    const fastify = Fastify();
    await fastify.register(requestid);

    fastify.get("/test", async () => ({ method: "GET" }));
    fastify.post("/test", async () => ({ method: "POST" }));
    fastify.put("/test", async () => ({ method: "PUT" }));
    fastify.delete("/test", async () => ({ method: "DELETE" }));

    const getResponse = await fastify.inject({ method: "GET", url: "/test" });
    const postResponse = await fastify.inject({ method: "POST", url: "/test" });
    const putResponse = await fastify.inject({ method: "PUT", url: "/test" });
    const deleteResponse = await fastify.inject({ method: "DELETE", url: "/test" });

    expect(getResponse.headers["x-request-id"]).toBeDefined();
    expect(postResponse.headers["x-request-id"]).toBeDefined();
    expect(putResponse.headers["x-request-id"]).toBeDefined();
    expect(deleteResponse.headers["x-request-id"]).toBeDefined();

    await fastify.close();
  });
});
