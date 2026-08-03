import { decode as cborDecode } from "cbor2";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  GITHUB_ERROR_NOT_FOUND,
  GITHUB_ERROR_RATE_LIMIT,
  GITHUB_ERROR_TIMEOUT,
  GITHUB_ERROR_UPSTREAM,
  GitHubApiError,
} from "../../../src/modules/github/errors.js";
import errorHandler from "../../../src/plugins/error-handler.js";
import sensible from "../../../src/plugins/sensible.js";
import { InvalidCursorError } from "../../../src/utils/pagination.js";
import { PortableError } from "../../../src/utils/portable-error.js";
import { schemaErrorFormatter } from "../../../src/utils/schema-error-formatter.js";

const apps: ReturnType<typeof Fastify>[] = [];

async function build() {
  const app = Fastify({ schemaErrorFormatter });
  apps.push(app);
  app.register(sensible);
  app.register(errorHandler);
  return app;
}

afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe("portable error handler", () => {
  it("returns a closed generic 500 problem and never leaks the thrown message", async () => {
    const app = await build();
    app.get("/error", async () => {
      throw new Error("private internal canary");
    });
    const response = await app.inject({ method: "GET", url: "/error" });

    expect(response.statusCode).toBe(500);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.headers.vary).toEqual(["Accept", "Origin"]);
    expect(response.headers.link).toBe('</schemas/ErrorModel.json>; rel="describedby"');
    expect(response.json()).toEqual({
      title: "Internal Server Error",
      status: 500,
      detail: "Internal server error",
      code: "internal_error",
    });
    expect(response.payload).not.toContain("private internal canary");
  });

  it("maps controlled portable errors to their exact stable tuple", async () => {
    const app = await build();
    app.get("/profile-missing", async () => {
      throw new PortableError("profile_not_found");
    });
    const response = await app.inject({ method: "GET", url: "/profile-missing" });
    expect(response.json()).toEqual({
      title: "Not Found",
      status: 404,
      detail: "Profile not found",
      code: "profile_not_found",
    });
  });

  it.each([
    [400, "invalid_request"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [405, "method_not_allowed"],
    [406, "not_acceptable"],
    [413, "payload_too_large"],
    [415, "unsupported_media_type"],
    [422, "validation_failed"],
    [429, "rate_limited"],
    [503, "dependency_unavailable"],
  ])("classifies an untyped framework %i as %s", async (statusCode, code) => {
    const app = await build();
    app.get("/status-error", async () => {
      throw Object.assign(new Error("private framework canary"), { statusCode });
    });
    const response = await app.inject({ method: "GET", url: "/status-error" });
    expect(response.json()).toMatchObject({ status: statusCode, code });
    expect(response.payload).not.toContain("private framework canary");
  });

  it("emits safe allowlisted validation issues", async () => {
    const app = await build();
    app.get("/validate", { schema: { querystring: { type: "object", required: ["limit"] } } }, async () => ({}));
    const response = await app.inject({ method: "GET", url: "/validate" });
    expect(response.json()).toMatchObject({
      title: "Unprocessable Content",
      status: 422,
      detail: "Request validation failed",
      code: "validation_failed",
      errors: [{ detail: "Request validation failed" }],
    });
  });

  it("encodes the same generic problem fields as CBOR when explicitly preferred", async () => {
    const app = await build();
    app.get("/error", async () => {
      throw new Error("private CBOR canary");
    });
    const response = await app.inject({ method: "GET", url: "/error", headers: { accept: "application/cbor" } });
    expect(response.headers["content-type"]).toBe("application/cbor");
    expect(cborDecode(response.rawPayload)).toEqual({
      title: "Internal Server Error",
      status: 500,
      detail: "Internal server error",
      code: "internal_error",
    });
  });

  it("does not treat application/problem+cbor as an implemented representation", async () => {
    const app = await build();
    const response = await app.inject({
      method: "GET",
      url: "/missing",
      headers: { accept: "application/problem+cbor" },
    });
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });

  it("returns exact 404 and 405 problems with a truthful Allow field", async () => {
    const app = await build();
    const missing = await app.inject({ method: "GET", url: "/missing" });
    const method = await app.inject({ method: "POST", url: "/v1/github/owners/octocat/repos" });
    expect(missing.json()).toMatchObject({ code: "not_found", status: 404 });
    expect(method.json()).toMatchObject({ code: "method_not_allowed", status: 405 });
    expect(method.headers.allow).toBe("GET");
  });

  it.each([
    [GITHUB_ERROR_NOT_FOUND, 404, "github_not_found"],
    [GITHUB_ERROR_UPSTREAM, 502, "github_upstream"],
    [GITHUB_ERROR_TIMEOUT, 504, "github_timeout"],
  ])("maps GitHub %s without exposing the provider error", async (providerCode, status, publicCode) => {
    const app = await build();
    app.get("/github", async () => {
      throw new GitHubApiError("private provider canary", status, providerCode);
    });
    const response = await app.inject({ method: "GET", url: "/github" });
    expect(response.json()).toMatchObject({ status, code: publicCode });
    expect(response.payload).not.toContain("private provider canary");
  });

  it("emits only validated quota hints for GitHub rate limits", async () => {
    const app = await build();
    app.get("/github", async () => {
      throw new GitHubApiError("private", 429, GITHUB_ERROR_RATE_LIMIT, "17", undefined, "200");
    });
    const response = await app.inject({ method: "GET", url: "/github" });
    expect(response.json()).toMatchObject({ code: "github_rate_limit", status: 429 });
    expect(response.headers["retry-after"]).toBe("17");
    expect(response.headers["x-ratelimit-reset"]).toBe("200");
  });

  it("maps cursor diagnostics to the generic invalid-request response", async () => {
    const app = await build();
    app.get("/cursor", async () => {
      throw new InvalidCursorError("private cursor layout canary");
    });
    const response = await app.inject({ method: "GET", url: "/cursor" });
    expect(response.json()).toEqual({
      title: "Bad Request",
      status: 400,
      detail: "Request is malformed",
      code: "invalid_request",
    });
  });
});
