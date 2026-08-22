import { Buffer } from "node:buffer";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock } from "../mocks/firebase.js";

const firebaseApp = createFirebaseAppMock();
const firebaseAuth = createFirebaseAuthMock();

function sizedHelloBody(size: number): Buffer {
  const fixed = Buffer.from('{"name":""}');
  if (size < fixed.length) throw new RangeError("requested body is too small");
  return Buffer.from(`{"name":"${"a".repeat(size - fixed.length)}"}`);
}

async function streamedHelloRequest(
  address: string,
  payload: Buffer,
  requestId: string,
): Promise<{ body: string; headers: IncomingHttpHeaders; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      new URL("/v1/hello", address),
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": requestId },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers,
            statusCode: response.statusCode ?? 0,
          }),
        );
      },
    );
    request.on("error", reject);
    const midpoint = Math.floor(payload.length / 2);
    request.write(payload.subarray(0, midpoint));
    request.end(payload.subarray(midpoint));
  });
}

async function chunkedHelloRequest(
  address: string,
  payload: Buffer,
  requestId: string,
): Promise<{ body: string; headers: IncomingHttpHeaders; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      new URL("/v1/hello", address),
      {
        method: "POST",
        headers: { "transfer-encoding": "chunked", "x-request-id": requestId },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers,
            statusCode: response.statusCode ?? 0,
          }),
        );
      },
    );
    request.on("error", reject);
    if (payload.length > 0) request.write(payload);
    request.end();
  });
}

vi.mock("firebase-admin/app", () => ({
  deleteApp: vi.fn().mockResolvedValue(undefined),
  getApps: vi.fn(() => [firebaseApp]),
  initializeApp: vi.fn(() => firebaseApp),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => firebaseAuth) }));

describe("portable raw HTTP boundary", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "silent");
    vi.stubEnv("CORS_ORIGINS", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    ["unknown query", "/v1/items?unknown=1", 400, "invalid_request"],
    ["repeated query", "/v1/items?limit=1&limit=2", 400, "invalid_request"],
    ["malformed escape", "/v1/items?cursor=%", 400, "invalid_request"],
    ["invalid UTF-8", "/v1/items?cursor=%C3%28", 400, "invalid_request"],
    ["empty cursor", "/v1/items?cursor=", 400, "invalid_request"],
    ["signed limit", "/v1/items?limit=-1", 422, "validation_failed"],
    ["fractional limit", "/v1/items?limit=1.0", 422, "validation_failed"],
    ["overflow limit", "/v1/items?limit=99999999999999999999", 422, "validation_failed"],
    ["missing limit value", "/v1/items?limit", 422, "validation_failed"],
    ["non-ASCII cursor", "/v1/items?cursor=%C3%A4", 400, "invalid_request"],
    ["whitespace cursor", "/v1/items?cursor=abc+def", 400, "invalid_request"],
    ["empty query member", "/v1/items?&unknown=1", 400, "invalid_request"],
    ["point-read query", "/v1/github/owners/octocat?limit=1", 400, "invalid_request"],
  ])("rejects %s before operation execution", async (_case, url, status, code) => {
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url });
    expect(response.json()).toMatchObject({ status, code });
    await app.close();
  });

  it("rejects unknown readiness and identity queries before Firebase authentication", async () => {
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();

    const [readiness, identity] = await Promise.all([
      app.inject({ method: "GET", url: "/status?unknown=1" }),
      app.inject({
        method: "GET",
        url: "/v1/auth/me?unknown=1",
        headers: { authorization: "Bearer synthetic-token" },
      }),
    ]);

    expect(readiness.json()).toMatchObject({ status: 400, code: "invalid_request" });
    expect(identity.json()).toMatchObject({ status: 400, code: "invalid_request" });
    expect(firebaseAuth.verifyIdToken).not.toHaveBeenCalled();
    await app.close();
  });

  it.each([
    ["unsupported content encoding", { "content-type": "application/json", "content-encoding": "gzip" }, "{}", 415],
    [
      "combined content encoding",
      { "content-type": "application/json", "content-encoding": "identity, gzip" },
      "{}",
      415,
    ],
    ["unknown JSON parameter", { "content-type": "application/json; profile=x" }, "{}", 415],
    ["CBOR parameter", { "content-type": "application/cbor; charset=utf-8" }, "x", 415],
    ["ambiguous media type", { "content-type": "application/json, application/cbor" }, "{}", 415],
    ["wrong JSON charset", { "content-type": "application/json; charset=latin1" }, "{}", 415],
    ["multiple JSON parameters", { "content-type": "application/json; charset=utf-8; profile=x" }, "{}", 415],
    ["malformed JSON parameter", { "content-type": "application/json; charset=utf-8=extra" }, "{}", 415],
    ["unterminated quoted charset", { "content-type": 'application/json; charset="utf-8' }, "{}", 415],
    ["trailing quoted charset", { "content-type": 'application/json; charset=utf-8"' }, "{}", 415],
    ["empty quoted charset", { "content-type": 'application/json; charset=""' }, "{}", 415],
    ["escaped wrong charset", { "content-type": 'application/json; charset="utf\\"-8"' }, "{}", 415],
    ["trailing JSON parameter", { "content-type": "application/json; charset=utf-8;" }, "{}", 415],
    ["empty CBOR parameter", { "content-type": "application/cbor;" }, "x", 415],
    ["missing body", { "content-type": "application/json" }, "", 400],
    ["missing CBOR body", { "content-type": "application/cbor" }, Buffer.alloc(0), 400],
    ["additional application member", { "content-type": "application/json" }, '{"name":"Ada","role":"admin"}', 422],
  ])("rejects %s before the hello handler", async (_case, headers, payload, status) => {
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();
    const response = await app.inject({ method: "POST", url: "/v1/hello", headers, payload });
    expect(response.statusCode).toBe(status);
    await app.close();
  });

  it("accepts exact identity encoding and UTF-8 JSON charset", async () => {
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/hello?",
      headers: { "content-type": "application/json; charset=UTF-8", "content-encoding": "identity" },
      payload: '{"name":"Ada"}',
    });
    expect(response.json()).toEqual({ message: "Hello, Ada!" });

    const quoted = await app.inject({
      method: "POST",
      url: "/v1/hello",
      headers: { "content-type": 'application/json; charset="UTF\\-8"' },
      payload: '{"name":"Grace"}',
    });
    expect(quoted.json()).toEqual({ message: "Hello, Grace!" });
    await app.close();
  });

  it("accepts exact parameter-free CBOR", async () => {
    const { encode } = await import("cbor2");
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/hello",
      headers: { accept: "application/cbor", "content-type": "application/cbor" },
      payload: Buffer.from(encode({ name: "Ada" })),
    });
    expect(response.statusCode).toBe(200);

    const malformed = await app.inject({
      method: "POST",
      url: "/v1/hello",
      headers: { "content-type": "application/cbor" },
      payload: Buffer.from([0xff]),
    });
    expect(malformed.json()).toMatchObject({ status: 400, code: "invalid_request" });
    await app.close();
  });

  it.each([
    [
      "duplicate map key",
      Buffer.from([
        0xa2, 0x64, 0x6e, 0x61, 0x6d, 0x65, 0x63, 0x41, 0x64, 0x61, 0x64, 0x6e, 0x61, 0x6d, 0x65, 0x65, 0x47, 0x72,
        0x61, 0x63, 0x65,
      ]),
    ],
    ["trailing item", Buffer.from([0xa1, 0x64, 0x6e, 0x61, 0x6d, 0x65, 0x63, 0x41, 0x64, 0x61, 0xf6])],
  ])("rejects CBOR with a %s through the HTTP parser boundary", async (_case, payload) => {
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/hello",
      headers: { "content-type": "application/cbor" },
      payload,
    });

    expect(response.json()).toMatchObject({ status: 400, code: "invalid_request" });
    await app.close();
  });

  it("distinguishes a missing media type on empty and non-empty bodies", async () => {
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();
    const empty = await app.inject({ method: "POST", url: "/v1/hello", payload: "" });
    const nonEmpty = await app.inject({ method: "POST", url: "/v1/hello", payload: Buffer.from("{}") });
    expect(empty.json()).toMatchObject({ status: 400, code: "invalid_request" });
    expect(nonEmpty.json()).toMatchObject({ status: 415, code: "unsupported_media_type" });
    await app.close();
  });

  it("classifies chunked content by received bytes rather than the transfer header", async () => {
    const { HelloService } = await import("../../src/modules/hello/service.js");
    const greet = vi.spyOn(HelloService.prototype, "greet");
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();
    const address = await app.listen({ host: "127.0.0.1", port: 0 });

    try {
      const [empty, nonEmpty] = await Promise.all([
        chunkedHelloRequest(address, Buffer.alloc(0), "chunked-empty"),
        chunkedHelloRequest(address, Buffer.from("{}"), "chunked-content"),
      ]);

      expect(empty.statusCode).toBe(400);
      expect(empty.headers["x-request-id"]).toBe("chunked-empty");
      expect(JSON.parse(empty.body)).toMatchObject({ status: 400, code: "invalid_request" });
      expect(nonEmpty.statusCode).toBe(415);
      expect(nonEmpty.headers["x-request-id"]).toBe("chunked-content");
      expect(JSON.parse(nonEmpty.body)).toMatchObject({ status: 415, code: "unsupported_media_type" });
      expect(greet).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("enforces the exact declared request-body boundary before the handler", async () => {
    const { HelloService } = await import("../../src/modules/hello/service.js");
    const greet = vi.spyOn(HelloService.prototype, "greet");
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();
    const cases = [
      [999_999, 422],
      [1_000_000, 422],
      [1_000_001, 413],
    ] as const;

    const responses = await Promise.all(
      cases.map(([size]) =>
        app.inject({
          method: "POST",
          url: "/v1/hello",
          headers: { "content-type": "application/json", "x-request-id": `declared-${size}` },
          payload: sizedHelloBody(size),
        }),
      ),
    );
    for (const [index, [size, status]] of cases.entries()) {
      const response = responses.at(index);
      if (response === undefined) throw new Error("missing declared-boundary response");
      expect(response.statusCode).toBe(status);
      expect(response.headers["x-request-id"]).toBe(`declared-${size}`);
    }
    expect(greet).not.toHaveBeenCalled();
    await app.close();
  });

  it("enforces the exact streamed request-body boundary over real HTTP", async () => {
    const { HelloService } = await import("../../src/modules/hello/service.js");
    const greet = vi.spyOn(HelloService.prototype, "greet");
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const cases = [
      [999_999, 422],
      [1_000_000, 422],
      [1_000_001, 413],
    ] as const;

    try {
      const responses = await Promise.all(
        cases.map(([size]) => streamedHelloRequest(address, sizedHelloBody(size), `streamed-${size}`)),
      );
      for (const [index, [size, status]] of cases.entries()) {
        const response = responses.at(index);
        if (response === undefined) throw new Error("missing streamed-boundary response");
        expect(response.statusCode).toBe(status);
        expect(response.headers["x-request-id"]).toBe(`streamed-${size}`);
        expect(JSON.parse(response.body)).toMatchObject({ status });
      }
      expect(greet).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
