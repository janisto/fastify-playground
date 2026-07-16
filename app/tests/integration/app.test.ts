import { Buffer } from "node:buffer";
import { Writable } from "node:stream";
import { decode as cborDecode, encode as cborEncode } from "cbor2";
import { request } from "undici";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock } from "../mocks/firebase.js";

// Mock firebase-admin modules
const mockApp = createFirebaseAppMock();
const mockAuth = createFirebaseAuthMock();

vi.mock("firebase-admin/app", () => ({
  deleteApp: vi.fn().mockResolvedValue(undefined),
  getApps: vi.fn(() => [mockApp]),
  initializeApp: vi.fn(() => mockApp),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => mockAuth),
}));

interface LogRecord {
  readonly [key: string]: unknown;
  readonly message?: string;
}

class JsonLineStream extends Writable {
  readonly lines: string[] = [];
  readonly records: LogRecord[] = [];

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    try {
      for (const line of chunk.toString().split("\n")) {
        if (line.length > 0) {
          this.lines.push(line);
          this.records.push(JSON.parse(line) as LogRecord);
        }
      }
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error("failed to parse log record"));
    }
  }
}

describe("App Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PORT", "3000");
    vi.stubEnv("HOST", "127.0.0.1");
    vi.stubEnv("LOG_LEVEL", "silent");
    vi.stubEnv("CORS_ORIGINS", "http://localhost:3000");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("enforces the application-wide handler deadline", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    expect(fastify.initialConfig).toMatchObject({ handlerTimeout: 15_000 });

    await fastify.close();
  });

  it("reports readiness without requiring an unused external datastore", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const [response, unsupported] = await Promise.all([
      fastify.inject({ method: "GET", url: "/status" }),
      fastify.inject({ method: "GET", url: "/status", headers: { accept: "application/cbor" } }),
    ]);

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers.link).toBe('</schemas/ReadinessResponse.json>; rel="describedBy"');
    expect(response.headers.vary).toEqual(["Accept", "Origin"]);
    expect(response.json()).toEqual({ status: "ready" });
    expect(unsupported.statusCode).toBe(406);
    expect(unsupported.headers["content-type"]).toBe("application/cbor");
    expect(cborDecode(unsupported.rawPayload)).toMatchObject({ status: 406 });
    await fastify.close();
  });

  it("preserves modeled lifecycle responses while a real listener drains", async () => {
    const { buildApp } = await import("../../src/app.js");
    const { shutdown } = await import("../../src/server.js");
    const fastify = await buildApp();
    const preCloseEntered = Promise.withResolvers<void>();
    const releasePreClose = Promise.withResolvers<void>();
    fastify.addHook("preClose", async () => {
      preCloseEntered.resolve();
      await releasePreClose.promise;
    });
    const address = await fastify.listen({ host: "127.0.0.1", port: 0 });
    const closeOperation = shutdown(fastify, "SIGTERM");
    await preCloseEntered.promise;

    try {
      const [status, health, rejectedWork] = await Promise.all([
        request(`${address}/status`, {
          headers: {
            accept: "application/cbor, application/json;q=0.5",
            "x-request-id": "shutdown-status-canary",
          },
        }),
        request(`${address}/health`),
        request(`${address}/v1/hello`, { headers: { accept: "application/cbor" } }),
      ]);
      const [statusPayload, healthPayload, rejectedWorkPayload] = await Promise.all([
        status.body.arrayBuffer().then((body) => cborDecode(Buffer.from(body))),
        health.body.json(),
        rejectedWork.body.arrayBuffer().then((body) => cborDecode(Buffer.from(body))),
      ]);

      expect(status.statusCode).toBe(503);
      expect(status.headers["retry-after"]).toBe("10");
      expect(status.headers["content-type"]).toBe("application/cbor");
      expect(status.headers["link"]).toBe('</schemas/ErrorModel.json>; rel="describedBy"');
      expect(status.headers["connection"]).toBe("close");
      expect(status.headers["vary"]).toEqual(["Accept", "Origin"]);
      expect(status.headers["x-request-id"]).toBe("shutdown-status-canary");
      expect(statusPayload).toEqual({
        title: "Service Unavailable",
        status: 503,
        detail: "Service is shutting down",
      });

      expect(health.statusCode).toBe(200);
      expect(health.headers["content-type"]).toContain("application/json");
      expect(healthPayload).toEqual({ status: "healthy" });

      expect(rejectedWork.statusCode).toBe(503);
      expect(rejectedWork.headers["retry-after"]).toBe("10");
      expect(rejectedWork.headers["content-type"]).toBe("application/cbor");
      expect(rejectedWork.headers["connection"]).toBe("close");
      expect(rejectedWorkPayload).toEqual({
        title: "Service Unavailable",
        status: 503,
        detail: "Service is shutting down",
      });
    } finally {
      releasePreClose.resolve();
      await closeOperation;
    }
  });

  it("protects the authenticated identity endpoint and returns only the public identity projection", async () => {
    mockAuth.verifyIdToken.mockResolvedValueOnce({
      uid: "user-123",
      email: "private-email-canary@example.com",
    });
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const unauthenticated = await fastify.inject({ method: "GET", url: "/v1/auth/me" });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.headers["content-type"]).toContain("application/problem+json");
    expect(mockAuth.verifyIdToken).not.toHaveBeenCalled();

    const authenticated = await fastify.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: {
        accept: "application/cbor",
        authorization: "Bearer valid-token",
      },
    });

    expect(authenticated.statusCode).toBe(200);
    expect(authenticated.headers["content-type"]).toBe("application/cbor");
    expect(cborDecode(authenticated.rawPayload)).toEqual({ userId: "user-123" });
    expect(authenticated.payload).not.toContain("private-email-canary");
    expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("valid-token", false);

    mockAuth.verifyIdToken.mockRejectedValueOnce(
      Object.assign(new Error("firebase-provider-detail-canary"), { code: "auth/internal-error" }),
    );
    const unavailable = await fastify.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: "Bearer another-token" },
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.headers["retry-after"]).toBe("10");
    expect(unavailable.json()).toMatchObject({
      title: "Service Unavailable",
      status: 503,
      detail: "Authentication service is unavailable",
    });
    expect(unavailable.payload).not.toContain("firebase-provider-detail-canary");
    await fastify.close();
  });

  it("emit one safe, correlated terminal record for an application error", async () => {
    const stream = new JsonLineStream();
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp({ loggerDestination: stream, loggerLevel: "info" });
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const parentId = "00f067aa0ba902b7";
    const requestId = "observability-integration";

    fastify.get("/observability-error-test", async () => {
      throw new Error("terminal-error-canary");
    });

    const response = await fastify.inject({
      method: "GET",
      url: "/observability-error-test?token=query-secret-canary",
      headers: {
        authorization: "Bearer authorization-secret-canary",
        cookie: "session=cookie-secret-canary",
        traceparent: `00-${traceId}-${parentId}-01`,
        "x-request-id": requestId,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers["x-request-id"]).toBe(requestId);

    await fastify.close();

    const terminalLines = stream.lines.filter(
      (line) => (JSON.parse(line) as LogRecord).message === "request completed",
    );
    expect(terminalLines).toHaveLength(1);
    const terminalLine = terminalLines[0];
    if (terminalLine === undefined) {
      throw new Error("expected one terminal access record");
    }
    const terminal = JSON.parse(terminalLine) as LogRecord;

    expect(terminal).toMatchObject({
      severity: "ERROR",
      message: "request completed",
      request_id: requestId,
      correlation_id: traceId,
      trace_id: traceId,
      parent_id: parentId,
      trace_flags: "01",
      trace_sampled: true,
      method: "GET",
      path: "/observability-error-test",
      path_template: "/observability-error-test",
      status: 500,
      "logging.googleapis.com/trace": traceId,
      "logging.googleapis.com/trace_sampled": true,
      err: { message: "terminal-error-canary" },
    });
    expect(terminal["logging.googleapis.com/spanId"]).toBeUndefined();
    expect(terminalLine.match(/"request_id":/g)).toHaveLength(1);
    expect(stream.records.filter((record) => record.message === "Server error")).toHaveLength(0);
    for (const secret of ["query-secret-canary", "authorization-secret-canary", "cookie-secret-canary"]) {
      expect(terminalLine).not.toContain(secret);
    }
  });

  it("have security headers from helmet plugin", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const response = await fastify.inject({
      method: "GET",
      url: "/",
    });

    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    // HSTS is disabled outside the production composition.
    expect(response.headers["strict-transport-security"]).toBeUndefined();

    await fastify.close();
  });

  it("handles CORS for localhost requests", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const response = await fastify.inject({
      method: "GET",
      url: "/",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");

    await fastify.close();
  });

  it("negotiate modeled API responses and reject unsupported success formats", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const json = await fastify.inject({
      method: "GET",
      url: "/v1/hello",
      headers: { accept: "application/json, application/cbor" },
    });
    const cbor = await fastify.inject({
      method: "GET",
      url: "/v1/hello",
      headers: { accept: "application/cbor" },
    });
    const rejected = await fastify.inject({
      method: "GET",
      url: "/v1/hello",
      headers: { accept: "text/html", "x-request-id": "negotiation-test" },
    });

    expect(json.statusCode).toBe(200);
    expect(json.headers["content-type"]).toContain("application/json");
    expect(json.json()).toEqual({ message: "Hello, World!" });
    expect(json.headers.link).toBe('</schemas/HelloResponse.json>; rel="describedBy"');

    expect(cbor.statusCode).toBe(200);
    expect(cbor.headers["content-type"]).toBe("application/cbor");
    expect(cborDecode(cbor.rawPayload)).toEqual({ message: "Hello, World!" });

    expect(rejected.statusCode).toBe(406);
    expect(rejected.headers["content-type"]).toContain("application/problem+json");
    expect(rejected.headers["x-request-id"]).toBe("negotiation-test");
    expect(rejected.headers.vary).toEqual(["Accept", "Origin"]);
    expect(rejected.json()).toMatchObject({ title: "Not Acceptable", status: 406 });
    await fastify.close();
  });

  it("negotiate before body parsing and encode validation problems as generic CBOR", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const rejected = await fastify.inject({
      method: "POST",
      url: "/v1/hello",
      headers: { accept: "text/html", "content-type": "application/cbor" },
      payload: Buffer.from([0xff]),
    });
    const validation = await fastify.inject({
      method: "POST",
      url: "/v1/hello",
      headers: { accept: "application/cbor", "content-type": "application/cbor" },
      payload: Buffer.from(cborEncode({ name: "" })),
    });

    expect(rejected.statusCode).toBe(406);
    expect(rejected.json()).toMatchObject({ status: 406 });

    expect(validation.statusCode).toBe(422);
    expect(validation.headers["content-type"]).toBe("application/cbor");
    expect(validation.headers.link).toBe('</schemas/ErrorModel.json>; rel="describedBy"');
    expect(cborDecode(validation.rawPayload)).toMatchObject({ status: 422, detail: "validation failed" });
    await fastify.close();
  });

  it("strictly negotiate schema documents", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const rejected = await fastify.inject({
      method: "GET",
      url: "/schemas/HelloResponse.json",
      headers: { accept: "application/json" },
    });
    const accepted = await fastify.inject({
      method: "GET",
      url: "/schemas/HelloResponse.json",
      headers: { accept: "application/schema+json" },
    });

    expect(rejected.statusCode).toBe(406);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.headers["content-type"]).toContain("application/schema+json");
    await fastify.close();
  });

  it("publishes a deployment-neutral, uniquely identified OpenAPI contract", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const response = await fastify.inject({ method: "GET", url: "/api-docs/json" });
    const document = response.json();
    const getHello = document.paths["/v1/hello/"].get;
    const postHello = document.paths["/v1/hello/"].post;
    const readiness = document.paths["/status"].get;
    const authenticatedUser = document.paths["/v1/auth/me"].get;

    expect(Object.keys(getHello.responses["200"].content)).toEqual(["application/json", "application/cbor"]);
    expect(Object.keys(getHello.responses["406"].content)).toEqual(["application/problem+json", "application/cbor"]);
    expect(getHello.responses["200"].headers).toHaveProperty("Vary");
    expect(getHello.responses["200"].headers).toHaveProperty("X-Request-ID");
    expect(getHello.responses["200"].headers).toHaveProperty("Link");
    expect(Object.keys(postHello.requestBody.content)).toEqual(["application/json", "application/cbor"]);
    expect(Object.keys(readiness.responses["200"].content)).toEqual(["application/json"]);
    expect(Object.keys(readiness.responses["503"].content)).toEqual(["application/problem+json", "application/cbor"]);
    expect(readiness.responses["503"].headers).toHaveProperty("Retry-After");
    expect(authenticatedUser.security).toEqual([{ bearerAuth: [] }]);
    expect(Object.keys(authenticatedUser.responses["200"].content)).toEqual(["application/json", "application/cbor"]);
    expect(document.servers).toEqual([{ url: "/", description: "Current server" }]);

    const operationIds: string[] = [];
    for (const path of Object.values(document.paths) as Record<string, Record<string, unknown>>[]) {
      for (const operation of Object.values(path)) {
        if (typeof operation !== "object" || operation === null || !("responses" in operation)) continue;
        expect(operation).toHaveProperty("operationId");
        const responses = (operation as { responses: Record<string, { headers?: Record<string, unknown> }> }).responses;
        expect(responses).toHaveProperty("503");
        expect(responses["503"]?.headers).toHaveProperty("Retry-After");
        operationIds.push((operation as { operationId: string }).operationId);
      }
    }
    expect(operationIds).toHaveLength(12);
    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(JSON.stringify(document)).not.toContain("application/problem+cbor");
    await fastify.close();
  });
});
