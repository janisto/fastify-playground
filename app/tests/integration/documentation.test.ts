import { readFileSync } from "node:fs";
import { decode as cborDecode } from "cbor2";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { buildApp as createApplication } from "../../src/app.js";
import { GitHubClient } from "../../src/modules/github/client.js";
import { createFirebaseAppMock, createFirebaseAuthMock } from "../mocks/firebase.js";

const firebaseApp = createFirebaseAppMock();
const firebaseAuth = createFirebaseAuthMock();
const unavailable = vi.fn<() => Promise<never>>();
const GITHUB_METHODS = [
  "getOwner",
  "listOwnerRepos",
  "getRepo",
  "listRepoActivity",
  "listRepoLanguages",
  "listRepoTags",
] as const;
vi.mock("firebase-admin/app", () => ({
  deleteApp: vi.fn().mockResolvedValue(undefined),
  getApps: vi.fn(() => [firebaseApp]),
  initializeApp: vi.fn(() => firebaseApp),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => firebaseAuth) }));

function links(value: string | string[] | undefined) {
  return [
    ...(Array.isArray(value) ? value.join(", ") : (value ?? "")).matchAll(
      /<([^>]+)>;\s*rel="([^"]+)"(?:;\s*type="([^"]+)")?/g,
    ),
  ].map((match) => ({ target: match[1], relation: match[2], type: match[3] }));
}
const INDEX_LINK = { target: "/llms.txt", relation: "describedby", type: "text/plain" };
const CATALOG_LINK = { target: "/.well-known/api-catalog", relation: "api-catalog", type: "application/linkset+json" };
const CATALOG_TYPE = 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';

describe("public API consumer discovery", () => {
  let app: Awaited<ReturnType<typeof createApplication>>;
  const dispatcher = getGlobalDispatcher();
  let network: MockAgent;

  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CORS_ORIGINS", "https://client.example");
    network = new MockAgent();
    network.disableNetConnect();
    for (const method of GITHUB_METHODS) {
      vi.spyOn(GitHubClient.prototype, method).mockRejectedValue(new Error("GitHub must not be called"));
    }
    setGlobalDispatcher(network);
    firebaseAuth.verifyIdToken.mockRejectedValue(new Error("authentication must not be called"));
    unavailable.mockRejectedValue(new Error("persistence must not be called"));
    const { buildApp } = await import("../../src/app.js");
    app = await buildApp({
      profileRepository: { create: unavailable, get: unavailable, update: unavailable, delete: unavailable },
    });
  });
  afterEach(async () => {
    await app.close();
    setGlobalDispatcher(dispatcher);
    await network.close();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("bootstraps the schema, guides, and health from only the origin without dependency calls", async () => {
    const response = await app.inject({ method: "GET", url: "/.well-known/api-catalog" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe(CATALOG_TYPE);
    expect(links(response.headers.link)).toEqual(expect.arrayContaining([INDEX_LINK, CATALOG_LINK]));
    const catalog = response.json<{
      linkset: {
        anchor: string;
        "service-desc": { href: string; type: string }[];
        "service-doc": { href: string; type: string }[];
        status: { href: string; type: string }[];
      }[];
    }>();
    expect(Object.keys(catalog)).toEqual(["linkset"]);
    expect(catalog.linkset).toHaveLength(1);
    const context = catalog.linkset.at(0);
    if (context === undefined) throw new Error("catalog is missing its application context");
    expect(new URL(context.anchor, "http://local.example/.well-known/api-catalog").href).toBe("http://local.example/");
    expect(context["service-desc"]).toEqual([{ href: "/openapi.json", type: "application/json" }]);
    expect(context["service-doc"]).toEqual([
      { href: "/llms.txt", type: "text/plain" },
      { href: "/llms-full.txt", type: "text/plain" },
    ]);
    expect(context.status).toEqual([{ href: "/health", type: "application/json" }]);
    await Promise.all(
      [...context["service-desc"], ...context["service-doc"], ...context.status].map(async (target) => {
        const url = new URL(target.href, "http://local.example/.well-known/api-catalog");
        expect(url.origin).toBe("http://local.example");
        const result = await app.inject({ method: "GET", url: url.pathname, headers: { accept: target.type } });
        expect(result.statusCode).toBe(200);
        expect(result.headers["content-type"]).toContain(target.type);
      }),
    );
    expect(firebaseAuth.verifyIdToken).not.toHaveBeenCalled();
    expect(unavailable).not.toHaveBeenCalled();
    for (const method of GITHUB_METHODS) expect(GitHubClient.prototype[method]).not.toHaveBeenCalled();
  });

  it.each(["/llms.txt", "/llms-full.txt"])("serves exact same-build bytes for %s", async (url) => {
    const response = await app.inject({ method: "GET", url, headers: { accept: "text/plain; charset=utf-8" } });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/plain; charset=utf-8");
    expect(response.rawPayload).toEqual(readFileSync(new URL(`../../..${url}`, import.meta.url)));
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f]{32}$/);
    expect(response.headers.vary).toContain("Accept");
  });

  it("returns corresponding GET metadata with no HEAD body", async () => {
    const get = await app.inject({ method: "GET", url: "/.well-known/api-catalog" });
    const head = await app.inject({ method: "HEAD", url: "/.well-known/api-catalog" });
    expect(head.statusCode).toBe(200);
    expect(head.rawPayload.byteLength).toBe(0);
    for (const header of ["content-type", "content-length", "link", "cache-control", "vary"]) {
      expect(head.headers[header]).toEqual(get.headers[header]);
    }
    expect(links(head.headers.link)).toEqual(expect.arrayContaining([INDEX_LINK, CATALOG_LINK]));
  });

  it.each([
    ["/openapi.json", "application/json"],
    ["/llms-full.txt", "text/plain"],
    ["/.well-known/api-catalog", "application/linkset+json"],
    ["/api-docs", "text/html"],
  ])("advertises the same-build index on %s", async (url, accept) => {
    const response = await app.inject({ method: "GET", url, headers: { accept } });
    expect(response.statusCode).toBe(200);
    expect(links(response.headers.link)).toContainEqual(INDEX_LINK);
  });

  it.each(["application/json", "application/cbor"])(
    "preserves schema and discovery links on %s health",
    async (accept) => {
      const response = await app.inject({ method: "GET", url: "/health", headers: { accept } });
      expect(response.statusCode).toBe(200);
      expect(accept === "application/cbor" ? cborDecode(response.rawPayload) : response.json()).toEqual({
        status: "healthy",
      });
      expect(links(response.headers.link)).toEqual(
        expect.arrayContaining([
          CATALOG_LINK,
          { target: "/openapi.json", relation: "service-desc", type: "application/json" },
          { target: "/schemas/HealthResponse.json", relation: "describedby", type: undefined },
        ]),
      );
      const document = await app.inject({ method: "GET", url: "/openapi.json" });
      expect(document.json()).toMatchObject({
        paths: { "/health": { get: { responses: { "200": { headers: { Link: { schema: { type: "string" } } } } } } } },
      });
    },
  );

  it.each([
    ["GET", "/llms.txt?unknown=1", 400, "invalid_request"],
    ["GET", "/llms-full.txt?x=1&x=2", 400, "invalid_request"],
    ["GET", "/.well-known/api-catalog?%FF=1", 400, "invalid_request"],
    ["GET", "/llms.txt", 406, "not_acceptable"],
    ["GET", "/.well-known/api-catalog", 406, "not_acceptable"],
    ["PUT", "/llms.txt", 405, "method_not_allowed"],
    ["POST", "/.well-known/api-catalog", 405, "method_not_allowed"],
  ] as const)("returns JSON Problem Details for %s %s", async (method, url, status, code) => {
    const response = await app.inject({ method, url, headers: { accept: "application/cbor" } });
    expect(response.statusCode).toBe(status);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({ status, code });
    if (status === 405) expect(response.headers.allow).toContain("GET");
    if (status === 405 && url.includes("api-catalog")) expect(response.headers.allow).toContain("HEAD");
  });

  it.each(["/.well-known/api-catalog?unknown=1", "/.well-known/api-catalog"])(
    "never emits a HEAD error body for %s",
    async (url) => {
      const response = await app.inject({ method: "HEAD", url, headers: { accept: "application/cbor" } });
      expect(response.statusCode).toBe(url.includes("?") ? 400 : 406);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      expect(response.rawPayload.byteLength).toBe(0);
    },
  );

  it("matches the catalog profile and rejects unsupported aliases and parameters", async () => {
    await Promise.all(
      ["application/linkset+json", CATALOG_TYPE, "*/*"].map(async (accept) => {
        const response = await app.inject({ method: "GET", url: "/.well-known/api-catalog", headers: { accept } });
        expect(response.statusCode).toBe(200);
        expect(response.headers["content-type"]).toBe(CATALOG_TYPE);
      }),
    );
    await Promise.all(
      [
        "application/json",
        'application/linkset+json; profile="https://invalid.example"',
        "application/linkset+json;q=0",
        "text/html",
      ].map(async (accept) => {
        const response = await app.inject({ method: "GET", url: "/.well-known/api-catalog", headers: { accept } });
        expect(response.statusCode).toBe(406);
      }),
    );
  });

  it("permits catalog HEAD preflight and exposes links only to configured origins", async () => {
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/.well-known/api-catalog",
      headers: {
        origin: "https://client.example",
        "access-control-request-method": "HEAD",
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers["access-control-allow-methods"]).toContain("HEAD");
    const response = await app.inject({
      method: "HEAD",
      url: "/.well-known/api-catalog",
      headers: { origin: "https://client.example" },
    });
    expect(response.headers["access-control-allow-origin"]).toBe("https://client.example");
    expect(response.headers["access-control-expose-headers"]).toContain("Link");
  });

  it.each(["/.env", "/AGENTS.md", "/package.json", "/app/src/app.ts", "/llms.txt/extra"])(
    "does not expose repository file %s",
    async (url) => {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: "not_found" });
    },
  );
  it.each(["/.well-known/api-catalog", "/llms.txt", "/llms-full.txt"])(
    "does not parse request content at %s",
    async (url) => {
      const response = await app.inject({
        method: "GET",
        url,
        headers: { "content-type": "application/json" },
        payload: "{broken",
      });
      expect(response.statusCode).toBe(200);
      const method = await app.inject({
        method: "POST",
        url,
        headers: { "content-type": "application/json", accept: "application/cbor" },
        payload: "{broken",
      });
      expect(method.statusCode).toBe(405);
      expect(method.headers["content-type"]).toContain("application/problem+json");
      expect(method.json()).toMatchObject({ code: "method_not_allowed" });
    },
  );
});
