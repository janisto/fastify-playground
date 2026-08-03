import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock } from "../mocks/firebase.js";

const firebaseApp = createFirebaseAppMock();
const firebaseAuth = createFirebaseAuthMock();

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

  it("distinguishes a missing media type on empty and non-empty bodies", async () => {
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp();
    const empty = await app.inject({ method: "POST", url: "/v1/hello", payload: "" });
    const nonEmpty = await app.inject({ method: "POST", url: "/v1/hello", payload: Buffer.from("{}") });
    expect(empty.json()).toMatchObject({ status: 400, code: "invalid_request" });
    expect(nonEmpty.json()).toMatchObject({ status: 415, code: "unsupported_media_type" });
    await app.close();
  });
});
