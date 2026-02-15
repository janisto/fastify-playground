import { decode as cborDecode } from "cbor2";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GITHUB_ERROR_FORBIDDEN,
  GITHUB_ERROR_NOT_FOUND,
  GITHUB_ERROR_RATE_LIMIT,
  GITHUB_ERROR_UPSTREAM,
  GitHubApiError,
  InvalidCursorError,
} from "../../../src/modules/github/errors.js";
import errorHandler from "../../../src/plugins/error-handler.js";
import sensiblePlugin from "../../../src/plugins/sensible.js";
import { schemaErrorFormatter } from "../../../src/utils/schema-error-formatter.js";

vi.mock("../../../src/env.js", () => ({
  env: {
    NODE_ENV: "test",
    PORT: 3000,
    HOST: "0.0.0.0",
    LOG_LEVEL: "info",
  },
}));

describe("Error Handler Plugin", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should return RFC 9457 Problem Details for server errors (500+)", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/error", async () => {
      throw new Error("Internal server error");
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/error",
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.headers.vary).toBe("Accept");
    expect(response.headers.link).toBe('</schemas/ErrorModel.json>; rel="describedBy"');

    const body = response.json();
    expect(body.$schema).toContain("/schemas/ErrorModel.json");
    expect(body.title).toBe("Internal Server Error");
    expect(body.status).toBe(500);
    expect(body.detail).toBe("Internal server error");

    await fastify.close();
  });

  it("should return RFC 9457 Problem Details for client errors (400+)", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/client-error", async () => {
      const error = new Error("Bad request") as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/client-error",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");

    const body = response.json();
    expect(body.title).toBe("Bad Request");
    expect(body.status).toBe(400);
    expect(body.detail).toBe("Bad request");

    await fastify.close();
  });

  it("should include errors array for validation errors", async () => {
    const fastify = Fastify({ schemaErrorFormatter });
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get(
      "/validate",
      {
        schema: {
          querystring: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
            },
          },
        },
      },
      async () => ({ success: true }),
    );

    const response = await fastify.inject({
      method: "GET",
      url: "/validate",
    });

    expect(response.statusCode).toBe(422);
    expect(response.headers["content-type"]).toContain("application/problem+json");

    const body = response.json();
    expect(body.title).toBe("Unprocessable Entity");
    expect(body.status).toBe(422);
    expect(body.detail).toBe("validation failed");
    expect(body.errors).toBeDefined();
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors[0]).toHaveProperty("message");
    expect(body.errors[0]).toHaveProperty("location");

    await fastify.close();
  });

  it("should return CBOR response when Accept header is application/cbor", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/cbor-error", async () => {
      throw new Error("CBOR error test");
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/cbor-error",
      headers: { accept: "application/cbor" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toBe("application/problem+cbor");

    const body = cborDecode(new Uint8Array(response.rawPayload)) as Record<string, unknown>;
    expect(body.title).toBe("Internal Server Error");
    expect(body.status).toBe(500);
    expect(body.detail).toBe("CBOR error test");

    await fastify.close();
  });

  it("should return CBOR response when Accept header is application/problem+cbor", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/problem-cbor-error", async () => {
      const error = new Error("Problem CBOR error") as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/problem-cbor-error",
      headers: { accept: "application/problem+cbor" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toBe("application/problem+cbor");

    const body = cborDecode(new Uint8Array(response.rawPayload)) as Record<string, unknown>;
    expect(body.title).toBe("Forbidden");
    expect(body.status).toBe(403);

    await fastify.close();
  });

  it("should return RFC 9457 Problem Details for 404 not found", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    const response = await fastify.inject({
      method: "GET",
      url: "/nonexistent-route",
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.headers.vary).toBe("Accept");
    expect(response.headers.link).toBe('</schemas/ErrorModel.json>; rel="describedBy"');

    const body = response.json();
    expect(body.$schema).toContain("/schemas/ErrorModel.json");
    expect(body.title).toBe("Not Found");
    expect(body.status).toBe(404);
    expect(body.detail).toBe("resource not found");

    await fastify.close();
  });

  it("should return CBOR 404 response when Accept header is application/cbor", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    const response = await fastify.inject({
      method: "GET",
      url: "/not-found-cbor",
      headers: { accept: "application/cbor" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe("application/problem+cbor");

    const body = cborDecode(new Uint8Array(response.rawPayload)) as Record<string, unknown>;
    expect(body.title).toBe("Not Found");
    expect(body.status).toBe(404);

    await fastify.close();
  });

  it("should hide internal error details in production for 5xx errors", async () => {
    vi.doMock("../../../src/env.js", () => ({
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "0.0.0.0",
        LOG_LEVEL: "info",
      },
    }));

    const { default: errorHandlerProd } = await import("../../../src/plugins/error-handler.js");
    const { default: sensiblePluginProd } = await import("../../../src/plugins/sensible.js");

    const fastify = Fastify();
    await fastify.register(sensiblePluginProd);
    await fastify.register(errorHandlerProd);

    fastify.get("/prod-server-error", async () => {
      throw new Error("Sensitive internal error details");
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/prod-server-error",
    });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.detail).toBe("An unexpected error occurred");
    expect(body.detail).not.toContain("Sensitive");

    await fastify.close();
  });

  it("should show error details in non-production for 5xx errors", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/dev-server-error", async () => {
      throw new Error("Detailed error message");
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/dev-server-error",
    });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.detail).toBe("Detailed error message");

    await fastify.close();
  });

  it("should default to 500 for errors without status code", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/no-status", async () => {
      throw new Error("No status code");
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/no-status",
    });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.status).toBe(500);
    expect(body.title).toBe("Internal Server Error");

    await fastify.close();
  });

  it("should handle errors with custom error codes", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/custom-error", async () => {
      const error = new Error("Custom forbidden error") as Error & { code?: string; statusCode?: number };
      error.code = "CUSTOM_ERROR_CODE";
      error.statusCode = 403;
      throw error;
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/custom-error",
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.title).toBe("Forbidden");
    expect(body.status).toBe(403);
    expect(body.detail).toBe("Custom forbidden error");

    await fastify.close();
  });

  it("should use x-forwarded-proto for schema URL when present", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/forwarded-error", async () => {
      throw new Error("Forwarded error");
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/forwarded-error",
      headers: {
        "x-forwarded-proto": "https",
        host: "api.example.com",
      },
    });

    const body = response.json();
    expect(body.$schema).toBe("https://api.example.com/schemas/ErrorModel.json");

    await fastify.close();
  });

  it("should handle GitHubApiError with 404 code", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/github-error", async () => {
      throw new GitHubApiError("Not Found", 404, GITHUB_ERROR_NOT_FOUND);
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/github-error",
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    const body = response.json();
    expect(body.title).toBe("Not Found");
    expect(body.status).toBe(404);
    expect(body.detail).toBe("Not Found");

    await fastify.close();
  });

  it("should handle GitHubApiError with rate limit and Retry-After header", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/github-rate-limit", async () => {
      throw new GitHubApiError("Rate limit exceeded", 429, GITHUB_ERROR_RATE_LIMIT, "60");
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/github-rate-limit",
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("60");
    const body = response.json();
    expect(body.title).toBe("Too Many Requests");
    expect(body.status).toBe(429);

    await fastify.close();
  });

  it("should handle GitHubApiError with forbidden code", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/github-forbidden", async () => {
      throw new GitHubApiError("Resource not accessible", 403, GITHUB_ERROR_FORBIDDEN);
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/github-forbidden",
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.title).toBe("Forbidden");
    expect(body.status).toBe(403);

    await fastify.close();
  });

  it("should handle GitHubApiError with upstream error code", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/github-upstream", async () => {
      throw new GitHubApiError("Upstream error", 502, GITHUB_ERROR_UPSTREAM);
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/github-upstream",
    });

    expect(response.statusCode).toBe(502);
    const body = response.json();
    expect(body.title).toBe("Bad Gateway");
    expect(body.status).toBe(502);

    await fastify.close();
  });

  it("should handle InvalidCursorError with 400 status", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/invalid-cursor", async () => {
      throw new InvalidCursorError("invalid cursor format");
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/invalid-cursor",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    const body = response.json();
    expect(body.title).toBe("Bad Request");
    expect(body.status).toBe(400);
    expect(body.detail).toBe("invalid cursor format");

    await fastify.close();
  });

  it("should handle GitHubApiError with CBOR response when client prefers CBOR", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/github-cbor", async () => {
      throw new GitHubApiError("Not Found", 404, GITHUB_ERROR_NOT_FOUND);
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/github-cbor",
      headers: {
        Accept: "application/cbor",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+cbor");

    const body = cborDecode(response.rawPayload) as Record<string, unknown>;
    expect(body.title).toBe("Not Found");
    expect(body.status).toBe(404);

    await fastify.close();
  });

  it("should handle InvalidCursorError with CBOR response when client prefers CBOR", async () => {
    const fastify = Fastify();
    await fastify.register(sensiblePlugin);
    await fastify.register(errorHandler);

    fastify.get("/cursor-cbor", async () => {
      throw new InvalidCursorError("bad cursor");
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/cursor-cbor",
      headers: {
        Accept: "application/cbor",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+cbor");

    const body = cborDecode(response.rawPayload) as Record<string, unknown>;
    expect(body.title).toBe("Bad Request");
    expect(body.status).toBe(400);
    expect(body.detail).toBe("bad cursor");

    await fastify.close();
  });
});
