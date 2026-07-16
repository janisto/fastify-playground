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

  async function build(checkRevoked = false) {
    const [{ default: sensible }, { default: firebase }, { default: auth }] = await Promise.all([
      import("../../../src/plugins/sensible.js"),
      import("../../../src/plugins/firebase.js"),
      import("../../../src/plugins/auth.js"),
    ]);
    const app = Fastify({ logger: false });
    apps.push(app);
    app.register(sensible);
    app.register(firebase);
    app.register(auth, { checkRevoked });
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
    expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("valid-token", false);
  });

  it("rejects a missing authorization header before Firebase", async () => {
    const response = await (await build()).inject({ method: "GET", url: "/protected" });

    expect(response.statusCode).toBe(401);
    expect(response.json().message).toBe("Missing authorization header");
    expect(mockAuth.verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong scheme", "Basic token"],
    ["missing token", "Bearer"],
    ["extra field", "Bearer valid-token extra"],
    ["multiple spaces", "Bearer  valid-token"],
    ["tab separator", "Bearer\tvalid-token"],
    ["leading whitespace", " Bearer valid-token"],
  ])("rejects an authorization header with %s before Firebase", async (_case, authorization) => {
    const response = await (await build()).inject({
      method: "GET",
      url: "/protected",
      headers: { authorization },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().message).toBe("Invalid authorization header format. Expected: Bearer <token>");
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
    expect(response.json().message).toBe("Invalid or expired token");
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
    expect(response.json().message).toBe("Authentication service is unavailable");
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
    expect(response.json().message).toBe("Token has been revoked. Please sign in again.");
    expect(response.payload).not.toContain("provider revocation canary");
  });
});
