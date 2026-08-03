import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock } from "../../mocks/firebase.js";

const mockApp = createFirebaseAppMock();
const mockAuth = createFirebaseAuthMock();

vi.mock("firebase-admin/app", () => ({
  deleteApp: vi.fn().mockResolvedValue(undefined),
  getApps: vi.fn(() => [mockApp]),
  initializeApp: vi.fn(() => mockApp),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => mockAuth) }));

describe("Firebase authentication", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  beforeEach(() => vi.clearAllMocks());
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function build(checkRevoked = true) {
    const [{ default: sensible }, { default: firebase }, { default: auth }, { default: errorHandler }] =
      await Promise.all([
        import("../../../src/plugins/sensible.js"),
        import("../../../src/plugins/firebase.js"),
        import("../../../src/plugins/auth.js"),
        import("../../../src/plugins/error-handler.js"),
      ]);
    const app = Fastify({ logger: false });
    apps.push(app);
    app.register(sensible);
    app.register(firebase);
    app.register(auth, { checkRevoked });
    app.register(errorHandler);
    app.register(async (scope) => {
      scope.get("/protected", { preHandler: [scope.authenticate] }, async (request) => ({
        uid: request.user?.uid,
      }));
    });
    return app;
  }

  it.each(["Bearer", "bearer", "BEARER"])("verifies a valid token with a %s scheme", async (scheme) => {
    mockAuth.verifyIdToken.mockResolvedValueOnce({ uid: "user-123" });
    const app = await build();

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: `${scheme} valid-token` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ uid: "user-123" });
    expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("valid-token", true);
  });

  it("rejects a missing authorization header before Firebase", async () => {
    const response = await (await build()).inject({ method: "GET", url: "/protected" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "unauthorized", detail: "Authentication is required or invalid" });
    expect(response.headers["www-authenticate"]).toBe("Bearer");
    expect(mockAuth.verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong scheme", "Basic token"],
    ["missing token", "Bearer"],
    ["extra field", "Bearer valid-token extra"],
    ["tab separator", "Bearer\tvalid-token"],
    ["leading whitespace", " Bearer valid-token"],
  ])("rejects an authorization header with %s before Firebase", async (_case, authorization) => {
    const response = await (await build()).inject({
      method: "GET",
      url: "/protected",
      headers: { authorization },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "unauthorized", detail: "Authentication is required or invalid" });
    expect(response.headers["www-authenticate"]).toBe("Bearer");
    expect(mockAuth.verifyIdToken).not.toHaveBeenCalled();
  });

  it("maps verification failure to a controlled authentication error", async () => {
    mockAuth.verifyIdToken.mockRejectedValueOnce(
      Object.assign(new Error("provider detail canary"), { code: "auth/id-token-expired" }),
    );
    const response = await (await build()).inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer expired-token" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "unauthorized", detail: "Authentication is required or invalid" });
    expect(response.headers["www-authenticate"]).toBe("Bearer");
    expect(response.payload).not.toContain("provider detail canary");
  });

  it.each([
    ["invalid credentials", "auth/invalid-credential"],
    ["internal provider failure", "auth/internal-error"],
    ["an unknown failure", null],
  ])("maps %s to controlled service unavailability", async (_case, code) => {
    const providerError = new Error("provider infrastructure canary");
    if (code !== null) Object.assign(providerError, { code });
    mockAuth.verifyIdToken.mockRejectedValueOnce(providerError);

    const response = await (await build()).inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer structurally-valid-token" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: "dependency_unavailable",
      detail: "A required dependency is unavailable",
    });
    expect(response.payload).not.toContain("provider infrastructure canary");
  });

  it("passes the revocation check through when enabled", async () => {
    mockAuth.verifyIdToken.mockResolvedValueOnce({ uid: "user-123" });
    const response = await (await build(true)).inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer valid-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("valid-token", true);
  });

  it("distinguishes a revoked token from other verification failures", async () => {
    mockAuth.verifyIdToken.mockRejectedValueOnce(
      Object.assign(new Error("provider revocation canary"), { code: "auth/id-token-revoked" }),
    );
    const response = await (await build(true)).inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer revoked-token" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "unauthorized", detail: "Authentication is required or invalid" });
    expect(response.headers["www-authenticate"]).toBe("Bearer");
    expect(response.payload).not.toContain("provider revocation canary");
  });

  it("accepts one or more ASCII spaces and token68 punctuation", async () => {
    mockAuth.verifyIdToken.mockResolvedValueOnce({ uid: "user-123" });
    const response = await (await build()).inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer   ._~+/-==" },
    });

    expect(response.statusCode).toBe(200);
    expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("._~+/-==", true);
  });

  it.each(["", "x".repeat(129)])("rejects an invalid verified principal %j", async (uid) => {
    mockAuth.verifyIdToken.mockResolvedValueOnce({ uid });
    const response = await (await build()).inject({
      method: "GET",
      url: "/protected",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(response.json()).toMatchObject({ status: 401, code: "unauthorized" });
  });
});
