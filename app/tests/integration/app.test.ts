import { Buffer } from "node:buffer";
import { Writable } from "node:stream";
import { decode as cborDecode, encode as cborEncode } from "cbor2";
import { request } from "undici";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileRepository } from "../../src/modules/profile/repository.js";
import type { Profile, ProfileCreate, ProfileUpdate } from "../../src/modules/profile/schemas.js";
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
    expect(response.headers.link).toBe('</schemas/ReadinessResponse.json>; rel="describedby"');
    expect(response.headers.vary).toEqual(["Accept", "Origin"]);
    expect(response.json()).toEqual({ status: "ready" });
    expect(unsupported.statusCode).toBe(406);
    expect(unsupported.headers["content-type"]).toBe("application/cbor");
    expect(cborDecode(unsupported.rawPayload)).toMatchObject({ status: 406 });
    await fastify.close();
  });

  it("derives truthful 405 responses from every registered application route", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();
    const cases = [
      ["POST", "/status", "GET, OPTIONS"],
      ["POST", "/v1/auth/me", "GET, OPTIONS"],
      ["PUT", "/v1/profile", "GET, POST, PATCH, DELETE, OPTIONS"],
      ["POST", "/schemas/Profile.json", "GET, OPTIONS"],
    ] as const;

    const responses = await Promise.all(
      cases.map(async ([method, url, allow]) => ({ allow, response: await fastify.inject({ method, url }) })),
    );
    for (const { allow, response } of responses) {
      expect(response.statusCode).toBe(405);
      expect(response.headers.allow).toBe(allow);
      expect(response.json()).toMatchObject({ status: 405, code: "method_not_allowed" });
    }
    const missing = await fastify.inject({ method: "GET", url: "/not-registered" });
    expect(missing.statusCode).toBe(404);
    expect(missing.headers.allow).toBeUndefined();
    expect(mockAuth.verifyIdToken).not.toHaveBeenCalled();
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
      expect(status.headers["link"]).toBe('</schemas/ErrorModel.json>; rel="describedby"');
      expect(status.headers["connection"]).toBe("close");
      expect(status.headers["vary"]).toEqual(["Accept", "Origin"]);
      expect(status.headers["x-request-id"]).toBe("shutdown-status-canary");
      expect(statusPayload).toEqual({
        title: "Service Unavailable",
        status: 503,
        detail: "A required dependency is unavailable",
        code: "dependency_unavailable",
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
        detail: "A required dependency is unavailable",
        code: "dependency_unavailable",
      });
    } finally {
      releasePreClose.resolve();
      await closeOperation;
    }
  });

  it("serves the complete portable corpus through a real loopback listener with deterministic dependencies", async () => {
    const { GitHubService } = await import("../../src/modules/github/service.js");
    const owner = {
      id: 1,
      login: "octocat",
      type: "User",
      name: "The Octocat",
      avatarUrl: "https://avatars.githubusercontent.com/u/1",
      htmlUrl: "https://github.com/octocat",
      company: null,
      blog: null,
      location: null,
      bio: null,
      publicRepos: 1,
      followers: 2,
      following: 0,
      createdAt: "2011-01-25T18:44:36.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    } as const;
    const repo = {
      id: 2,
      name: "repo",
      fullName: "octocat/repo",
      description: null,
      htmlUrl: "https://github.com/octocat/repo",
      fork: false,
    } as const;
    const getOwner = vi.spyOn(GitHubService.prototype, "getOwner").mockResolvedValue(owner);
    const listOwnerRepos = vi.spyOn(GitHubService.prototype, "listOwnerRepos").mockResolvedValue({ items: [repo] });
    const getRepo = vi.spyOn(GitHubService.prototype, "getRepo").mockResolvedValue({
      ...repo,
      language: "TypeScript",
      stargazersCount: 3,
      forksCount: 1,
      openIssuesCount: 0,
      archived: false,
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      pushedAt: null,
      defaultBranch: "main",
      license: "MIT",
      topics: ["fastify"],
      disabled: false,
    });
    const listRepoActivity = vi.spyOn(GitHubService.prototype, "listRepoActivity").mockResolvedValue({
      items: [
        {
          id: 3,
          actor: "octocat",
          actorAvatarUrl: "https://avatars.githubusercontent.com/u/1",
          ref: "refs/heads/main",
          timestamp: "2026-03-10T00:00:00.000Z",
          activityType: "push",
        },
      ],
    });
    const listRepoLanguages = vi
      .spyOn(GitHubService.prototype, "listRepoLanguages")
      .mockResolvedValue({ languages: [{ name: "TypeScript", bytes: 42 }] });
    const listRepoTags = vi.spyOn(GitHubService.prototype, "listRepoTags").mockResolvedValue({
      items: [{ name: "v1.0.0", commit: { sha: "a".repeat(40) } }],
    });

    let stored: Profile | undefined;
    const repository: ProfileRepository = {
      async create(id: string, input: ProfileCreate, now: string) {
        if (stored) return null;
        stored = { id, ...input, marketingOptIn: input.marketingOptIn ?? false, createdAt: now, updatedAt: now };
        return structuredClone(stored);
      },
      async get() {
        return stored ? structuredClone(stored) : null;
      },
      async update(_id: string, input: ProfileUpdate, now: string) {
        if (!stored) return null;
        stored = { ...stored, ...input, updatedAt: now };
        return structuredClone(stored);
      },
      async delete() {
        if (!stored) return false;
        stored = undefined;
        return true;
      },
    };
    mockAuth.verifyIdToken.mockResolvedValue({ uid: "real-http-user" });
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp({
      profileRepository: repository,
      profileClock: () => new Date("2026-03-10T12:00:00.000Z"),
    });
    const address = await fastify.listen({ host: "127.0.0.1", port: 0 });

    const status = async (path: string, options?: Parameters<typeof request>[1]): Promise<number> => {
      const response = await request(`${address}${path}`, options);
      await response.body.dump();
      return response.statusCode;
    };
    try {
      expect(await status("/health")).toBe(200);
      expect(await status("/v1/hello")).toBe(200);
      expect(
        await status("/v1/hello", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Ada" }),
        }),
      ).toBe(200);

      expect(await status("/v1/items")).toBe(200);
      const firstItemPage = await request(`${address}/v1/items?limit=1`);
      expect(firstItemPage.statusCode).toBe(200);
      await firstItemPage.body.dump();
      const nextTarget = /<([^>]+)>; rel="next"/.exec(String(firstItemPage.headers["link"]))?.[1];
      expect(nextTarget).toEqual(expect.any(String));
      expect(await status(nextTarget ?? "/invalid")).toBe(200);
      expect(await status("/v1/items?limit=100")).toBe(200);
      expect(await status("/v1/items?category=tools")).toBe(200);
      expect(await status("/v1/items?limit=0")).toBe(422);

      const authorization = { authorization: "Bearer real-http-user" };
      expect(await status("/v1/profile")).toBe(401);
      expect(
        await status("/v1/profile", {
          method: "POST",
          headers: { ...authorization, "content-type": "application/json" },
          body: JSON.stringify({
            firstName: "Ada",
            lastName: "Lovelace",
            contactEmail: "Ada@EXAMPLE.COM",
            phoneNumber: "+358401234567",
            termsAccepted: true,
          }),
        }),
      ).toBe(201);
      expect(await status("/v1/profile", { headers: authorization })).toBe(200);
      expect(
        await status("/v1/profile", {
          method: "PATCH",
          headers: { ...authorization, "content-type": "application/json" },
          body: JSON.stringify({ marketingOptIn: true }),
        }),
      ).toBe(200);
      expect(await status("/v1/profile", { method: "DELETE", headers: authorization })).toBe(204);

      const githubSuccesses = [
        "/v1/github/owners/octocat",
        "/v1/github/owners/octocat/repos?limit=2",
        "/v1/github/repos/octocat/repo",
        "/v1/github/repos/octocat/repo/activity?limit=2",
        "/v1/github/repos/octocat/repo/languages",
        "/v1/github/repos/octocat/repo/tags?limit=2",
      ];
      expect(await Promise.all(githubSuccesses.map((path) => status(path)))).toEqual(Array(6).fill(200));
      const githubRejections = [
        "/v1/github/owners/-",
        "/v1/github/owners/-/repos",
        "/v1/github/repos/-/repo",
        "/v1/github/repos/octocat/.../activity",
        "/v1/github/repos/octocat/.../languages",
        "/v1/github/repos/octocat/repo/tags?limit=101",
      ];
      expect(await Promise.all(githubRejections.map((path) => status(path)))).toEqual(Array(6).fill(422));
      for (const spy of [getOwner, listOwnerRepos, getRepo, listRepoActivity, listRepoLanguages, listRepoTags]) {
        expect(spy).toHaveBeenCalledOnce();
      }

      const openapi = await request(`${address}/openapi.json`);
      expect(openapi.statusCode).toBe(200);
      const document = (await openapi.body.json()) as {
        paths?: Record<string, Record<string, { operationId?: string }>>;
      };
      const portableOperationIds = new Set([
        "getHealth",
        "getHello",
        "createHello",
        "listItems",
        "createProfile",
        "getProfile",
        "updateProfile",
        "deleteProfile",
        "getGitHubOwner",
        "listGitHubOwnerRepositories",
        "getGitHubRepository",
        "listGitHubRepositoryActivity",
        "listGitHubRepositoryLanguages",
        "listGitHubRepositoryTags",
      ]);
      const servedPortableOperations = Object.values(document.paths ?? {})
        .flatMap((path) => Object.values(path))
        .filter((operation) => operation.operationId && portableOperationIds.has(operation.operationId));
      expect(servedPortableOperations).toHaveLength(14);
    } finally {
      await fastify.close();
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
    expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("valid-token", true);

    mockAuth.verifyIdToken.mockRejectedValueOnce(
      Object.assign(new Error("firebase-provider-detail-canary"), { code: "auth/internal-error" }),
    );
    const unavailable = await fastify.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: "Bearer another-token" },
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.headers["retry-after"]).toBeUndefined();
    expect(unavailable.json()).toMatchObject({
      title: "Service Unavailable",
      status: 503,
      detail: "A required dependency is unavailable",
      code: "dependency_unavailable",
    });
    expect(unavailable.payload).not.toContain("firebase-provider-detail-canary");
    await fastify.close();
  });

  it("emits one correlated terminal record without request or error details", async () => {
    const stream = new JsonLineStream();
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp({ loggerDestination: stream, loggerLevel: "info" });
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const parentId = "00f067aa0ba902b7";
    const requestId = "observability-integration";

    fastify.get("/observability-error-test", async () => {
      throw Object.assign(new Error("terminal-error-canary", { cause: new Error("error-cause-secret-canary") }), {
        authorization: "Bearer error-property-secret-canary",
      });
    });

    const response = await fastify.inject({
      method: "GET",
      remoteAddress: "192.0.2.1",
      url: "/observability-error-test?token=query-secret-canary",
      headers: {
        authorization: "Bearer authorization-secret-canary",
        cookie: "session=cookie-secret-canary",
        traceparent: `00-${traceId}-${parentId}-03`,
        "user-agent": "user-agent-secret-canary",
        "x-forwarded-for": "203.0.113.99",
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
      trace_flags: "03",
      trace_sampled: true,
      method: "GET",
      path_template: "/observability-error-test",
      status: 500,
      "logging.googleapis.com/trace": traceId,
      "logging.googleapis.com/trace_sampled": true,
      httpRequest: {
        requestMethod: "GET",
        status: 500,
      },
    });
    expect(terminal).not.toHaveProperty("path");
    expect(terminal).not.toHaveProperty("peer_ip");
    expect(terminal).not.toHaveProperty("user_agent");
    expect(terminal).not.toHaveProperty("terminal_reason");
    expect(terminal).not.toHaveProperty("trace_id_random");
    expect(terminal).not.toHaveProperty("err");
    expect(terminal).not.toHaveProperty("httpRequest.requestUrl");
    expect(terminal).not.toHaveProperty("httpRequest.remoteIp");
    expect(terminal).not.toHaveProperty("httpRequest.userAgent");
    expect(terminal["logging.googleapis.com/spanId"]).toBeUndefined();
    expect(terminalLine.match(/"request_id":/g)).toHaveLength(1);
    expect(stream.records.filter((record) => record.message === "Server error")).toHaveLength(0);
    for (const secret of [
      "query-secret-canary",
      "authorization-secret-canary",
      "cookie-secret-canary",
      "user-agent-secret-canary",
      "terminal-error-canary",
      "error-cause-secret-canary",
      "error-property-secret-canary",
      "192.0.2.1",
      "203.0.113.99",
    ]) {
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
    expect(json.headers.link).toBe('</schemas/HelloResponse.json>; rel="describedby"');

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
    expect(validation.headers.link).toBe('</schemas/ErrorModel.json>; rel="describedby"');
    expect(cborDecode(validation.rawPayload)).toMatchObject({
      status: 422,
      detail: "Request validation failed",
      code: "validation_failed",
    });
    await fastify.close();
  });

  it("rejects unsupported text request bodies without breaking JSON or CBOR", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const textResponses = await Promise.all(
      ["text/plain", "text/plain; charset=utf-8"].map((contentType, index) =>
        fastify.inject({
          method: "POST",
          url: "/v1/hello",
          headers: {
            "content-type": contentType,
            "x-request-id": `unsupported-text-${index}`,
          },
          payload: JSON.stringify({ name: "Ada" }),
        }),
      ),
    );
    const json = await fastify.inject({
      method: "POST",
      url: "/v1/hello",
      headers: { "content-type": "application/json; charset=utf-8" },
      payload: JSON.stringify({ name: "Ada" }),
    });
    const cbor = await fastify.inject({
      method: "POST",
      url: "/v1/hello",
      headers: { accept: "application/cbor", "content-type": "application/cbor" },
      payload: Buffer.from(cborEncode({ name: "Ada" })),
    });

    for (const [index, response] of textResponses.entries()) {
      expect(response.statusCode).toBe(415);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      expect(response.headers["x-request-id"]).toBe(`unsupported-text-${index}`);
      expect(response.headers.vary).toEqual(["Accept", "Origin"]);
      expect(response.headers.link).toBe('</schemas/ErrorModel.json>; rel="describedby"');
      expect(response.json()).toMatchObject({ title: "Unsupported Media Type", status: 415 });
      expect(response.json()).not.toHaveProperty("errors");
    }

    expect(json.statusCode).toBe(200);
    expect(json.json()).toEqual({ message: "Hello, Ada!" });
    expect(cbor.statusCode).toBe(200);
    expect(cbor.headers["content-type"]).toBe("application/cbor");
    expect(cborDecode(cbor.rawPayload)).toEqual({ message: "Hello, Ada!" });
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

  it("documents GitHub validation failures and rejects them before calling the service", async () => {
    const { GitHubService } = await import("../../src/modules/github/service.js");
    const listActivity = vi.spyOn(GitHubService.prototype, "listRepoActivity");
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const invalid = await fastify.inject({
      method: "GET",
      url: "/v1/github/repos/octocat/git-consortium/activity?limit=101",
    });
    const document = await fastify.inject({ method: "GET", url: "/api-docs/json" }).then((response) => response.json());
    const githubOperations = Object.entries(document.paths)
      .filter(([path]) => path.startsWith("/v1/github/"))
      .flatMap(([, pathItem]) => Object.values(pathItem as Record<string, unknown>))
      .filter(
        (operation): operation is { responses: Record<string, unknown> } =>
          typeof operation === "object" && operation !== null && "responses" in operation,
      );

    expect(invalid.statusCode).toBe(422);
    expect(invalid.headers["content-type"]).toContain("application/problem+json");
    expect(invalid.json()).toMatchObject({
      status: 422,
      detail: "Request validation failed",
      code: "validation_failed",
    });
    expect(listActivity).not.toHaveBeenCalled();
    expect(githubOperations).toHaveLength(6);
    for (const operation of githubOperations) {
      expect(operation.responses).toHaveProperty("422");
    }
    await fastify.close();
  });

  it("publishes a deployment-neutral, uniquely identified OpenAPI contract", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const response = await fastify.inject({ method: "GET", url: "/openapi.json" });
    const document = response.json();
    const getHello = document.paths["/v1/hello"].get;
    const postHello = document.paths["/v1/hello"].post;
    const createProfile = document.paths["/v1/profile"].post;

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(Object.keys(getHello.responses["200"].content)).toEqual(["application/json", "application/cbor"]);
    expect(Object.keys(getHello.responses["406"].content)).toEqual(["application/problem+json", "application/cbor"]);
    expect(getHello.responses["200"].headers).toHaveProperty("Vary");
    expect(getHello.responses["200"].headers).toHaveProperty("X-Request-ID");
    expect(getHello.responses["200"].headers).toHaveProperty("Link");
    expect(getHello.responses["406"].headers).toHaveProperty("Link");
    expect(getHello.security).toEqual([]);
    expect(Object.keys(postHello.requestBody.content)).toEqual(["application/json", "application/cbor"]);
    expect(postHello.operationId).toBe("createHello");
    expect(createProfile.security).toEqual([{ bearerAuth: [] }]);
    expect(createProfile.responses["201"].headers).toHaveProperty("Location");
    expect(createProfile.responses["401"].headers).toHaveProperty("WWW-Authenticate");
    expect(createProfile.responses["503"].headers).not.toHaveProperty("Retry-After");
    expect(createProfile.requestBody.required).toBe(true);
    expect(createProfile.requestBody.content["application/json"].schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["firstName", "lastName", "contactEmail", "phoneNumber", "termsAccepted"],
    });
    expect(document.servers).toEqual([{ url: "/", description: "Current server" }]);

    const expected = [
      ["get", "/health", "getHealth"],
      ["get", "/v1/hello", "getHello"],
      ["post", "/v1/hello", "createHello"],
      ["get", "/v1/items", "listItems"],
      ["post", "/v1/profile", "createProfile"],
      ["get", "/v1/profile", "getProfile"],
      ["patch", "/v1/profile", "updateProfile"],
      ["delete", "/v1/profile", "deleteProfile"],
      ["get", "/v1/github/owners/{owner}", "getGitHubOwner"],
      ["get", "/v1/github/owners/{owner}/repos", "listGitHubOwnerRepositories"],
      ["get", "/v1/github/repos/{owner}/{repo}", "getGitHubRepository"],
      ["get", "/v1/github/repos/{owner}/{repo}/activity", "listGitHubRepositoryActivity"],
      ["get", "/v1/github/repos/{owner}/{repo}/languages", "listGitHubRepositoryLanguages"],
      ["get", "/v1/github/repos/{owner}/{repo}/tags", "listGitHubRepositoryTags"],
    ] as const;
    const actual = expected.map(([method, path]) => [method, path, document.paths[path]?.[method]?.operationId]);
    expect(actual).toEqual(expected);
    expect(new Set(expected.map(([, , operationId]) => operationId)).size).toBe(14);
    expect(document.paths["/openapi.json"]).toBeUndefined();
    expect(document.openapi).toMatch(/^3\.1\./);
    expect(JSON.stringify(document)).not.toContain("application/problem+cbor");

    const expectedStatuses: Record<string, string[]> = {
      getHealth: ["200", "400", "406", "500"],
      getHello: ["200", "400", "406", "500"],
      createHello: ["200", "400", "406", "413", "415", "422", "500"],
      listItems: ["200", "400", "406", "422", "500"],
      createProfile: ["201", "400", "401", "406", "409", "413", "415", "422", "500", "503"],
      getProfile: ["200", "400", "401", "404", "406", "500", "503"],
      updateProfile: ["200", "400", "401", "404", "406", "413", "415", "422", "500", "503"],
      deleteProfile: ["204", "400", "401", "404", "500", "503"],
      getGitHubOwner: ["200", "400", "404", "406", "422", "429", "500", "502", "504"],
      listGitHubOwnerRepositories: ["200", "400", "404", "406", "422", "429", "500", "502", "504"],
      getGitHubRepository: ["200", "400", "404", "406", "422", "429", "500", "502", "504"],
      listGitHubRepositoryActivity: ["200", "400", "404", "406", "422", "429", "500", "502", "504"],
      listGitHubRepositoryLanguages: ["200", "400", "404", "406", "422", "429", "500", "502", "504"],
      listGitHubRepositoryTags: ["200", "400", "404", "406", "422", "429", "500", "502", "504"],
    };
    const requiredHeaders = [
      "Vary",
      "X-Request-ID",
      "Cache-Control",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
    ];
    for (const [, path, operationId] of expected) {
      const method = expected.find((entry) => entry[2] === operationId)?.[0];
      const operation = document.paths[path][method ?? "get"];
      expect(Object.keys(operation.responses).toSorted()).toEqual(expectedStatuses[operationId]);
      expect(operation.parameters).toContainEqual(
        expect.objectContaining({
          name: "X-Request-ID",
          in: "header",
          required: false,
          schema: expect.objectContaining({ maxLength: 128, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$" }),
        }),
      );
      for (const [status, projectedResponse] of Object.entries(operation.responses) as Array<
        [string, Record<string, unknown>]
      >) {
        expect(Object.keys(projectedResponse["headers"] as Record<string, unknown>)).toEqual(
          expect.arrayContaining(requiredHeaders),
        );
        if (status === "204") {
          expect(projectedResponse["headers"]).not.toHaveProperty("Link");
        } else {
          expect(projectedResponse["headers"]).toHaveProperty("Link");
        }
      }
    }

    const readinessUnavailable = document.paths["/status"].get.responses["503"];
    expect(readinessUnavailable.headers["Retry-After"].schema).toEqual({
      type: "integer",
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    });

    const quota = document.paths["/v1/github/owners/{owner}"].get.responses["429"];
    expect(quota.headers["Retry-After"].schema).toEqual({
      type: "integer",
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    });
    expect(quota.headers["X-RateLimit-Reset"].schema).toEqual({
      type: "integer",
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER,
    });
    expect(quota.content["application/problem+json"].schema.allOf[1].properties).toMatchObject({
      status: { const: 429 },
      code: { const: "github_rate_limit" },
      detail: { const: "GitHub rate limit exceeded" },
    });
    expect(
      document.paths["/v1/profile"].get.responses["404"].content["application/problem+json"].schema.allOf[1].properties,
    ).toMatchObject({ status: { const: 404 }, code: { const: "profile_not_found" } });
    expect(document.paths["/v1/items"].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "limit",
          in: "query",
          required: false,
          schema: expect.objectContaining({ default: 20, minimum: 1, maximum: 100 }),
        }),
        expect.objectContaining({
          name: "cursor",
          in: "query",
          required: false,
          schema: expect.objectContaining({ maxLength: 2048 }),
        }),
      ]),
    );
    expect(document.components.schemas.ItemsResponse.properties.items.items.properties.price).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["amountMinor", "currency"],
      properties: {
        amountMinor: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
        currency: { type: "string", enum: ["USD"] },
      },
    });
    await fastify.close();
  });
});
