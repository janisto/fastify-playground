import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock, createFirestoreMock } from "../../mocks/firebase.js";

// Mock firebase-admin modules
const mockApp = createFirebaseAppMock();
const mockAuth = createFirebaseAuthMock();
const mockFirestore = createFirestoreMock();

vi.mock("firebase-admin/app", () => ({
  getApps: vi.fn(() => [mockApp]),
  initializeApp: vi.fn(() => mockApp),
  cert: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => mockAuth),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => mockFirestore),
}));

describe("Auth Plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.resetModules();
  });

  describe("Plugin Registration", () => {
    it("should register authenticate decorator", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin);
      await fastify.ready();

      expect(fastify.authenticate).toBeDefined();
      expect(typeof fastify.authenticate).toBe("function");

      await fastify.close();
    });

    it("should decorate request with user property", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      const mockDecodedToken = {
        uid: "test-user-123",
        email: "test@example.com",
        email_verified: true,
      };
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin);

      fastify.get("/test", { preHandler: [fastify.authenticate] }, async (request) => {
        return { userId: request.user?.uid };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          authorization: "Bearer valid-token",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ userId: "test-user-123" });

      await fastify.close();
    });
  });

  describe("Authentication", () => {
    it("should return 401 when authorization header is missing", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin);

      fastify.get("/protected", { preHandler: [fastify.authenticate] }, async () => {
        return { success: true };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.message).toContain("Missing authorization header");

      await fastify.close();
    });

    it("should return 401 when authorization header has invalid format", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin);

      fastify.get("/protected", { preHandler: [fastify.authenticate] }, async () => {
        return { success: true };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "InvalidFormat token",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.message).toContain("Invalid authorization header format");

      await fastify.close();
    });

    it("should return 401 when token is missing after Bearer", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin);

      fastify.get("/protected", { preHandler: [fastify.authenticate] }, async () => {
        return { success: true };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer ",
        },
      });

      expect(response.statusCode).toBe(401);

      await fastify.close();
    });

    it("should return 401 when token verification fails", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      mockAuth.verifyIdToken.mockRejectedValue(new Error("Token expired"));

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin);

      fastify.get("/protected", { preHandler: [fastify.authenticate] }, async () => {
        return { success: true };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer expired-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.message).toContain("Invalid or expired token");

      await fastify.close();
    });

    it("should allow access with valid token", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      const mockDecodedToken = {
        uid: "user-456",
        email: "valid@example.com",
        email_verified: true,
        iss: "https://securetoken.google.com/test-project",
        aud: "test-project",
        auth_time: Math.floor(Date.now() / 1000),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        firebase: {
          identities: { email: ["valid@example.com"] },
          sign_in_provider: "password",
        },
      };
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin);

      fastify.get("/protected", { preHandler: [fastify.authenticate] }, async (request) => {
        return {
          success: true,
          email: request.user?.email,
        };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer valid-token-here",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        email: "valid@example.com",
      });
      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("valid-token-here", false);

      await fastify.close();
    });

    it("should handle case-insensitive Bearer scheme", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      const mockDecodedToken = { uid: "user-789" };
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin);

      fastify.get("/protected", { preHandler: [fastify.authenticate] }, async () => {
        return { success: true };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "bearer lowercase-token",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("lowercase-token", false);

      await fastify.close();
    });
  });

  describe("Token Revocation Check", () => {
    it("should pass checkRevoked=true when option is enabled", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      const mockDecodedToken = { uid: "user-123" };
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin, { checkRevoked: true });

      fastify.get("/protected", { preHandler: [fastify.authenticate] }, async () => {
        return { success: true };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer valid-token",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("valid-token", true);

      await fastify.close();
    });

    it("should return 401 with specific message when token is revoked", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      const revokedError = Object.assign(new Error("Token has been revoked"), {
        code: "auth/id-token-revoked",
      });
      mockAuth.verifyIdToken.mockRejectedValue(revokedError);

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin, { checkRevoked: true });

      fastify.get("/protected", { preHandler: [fastify.authenticate] }, async () => {
        return { success: true };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer revoked-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.message).toContain("Token has been revoked");

      await fastify.close();
    });

    it("should default to checkRevoked=false when option is not provided", async () => {
      const { default: sensiblePlugin } = await import("../../../src/plugins/sensible.js");
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: authPlugin } = await import("../../../src/plugins/auth.js");

      const mockDecodedToken = { uid: "user-123" };
      mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

      const fastify = Fastify();
      await fastify.register(sensiblePlugin);
      await fastify.register(firebasePlugin);
      await fastify.register(authPlugin);

      fastify.get("/protected", { preHandler: [fastify.authenticate] }, async () => {
        return { success: true };
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer valid-token",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("valid-token", false);

      await fastify.close();
    });
  });
});
