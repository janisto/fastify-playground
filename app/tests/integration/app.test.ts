import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock, createFirestoreMock } from "../mocks/firebase.js";

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

describe("App Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirestore._mocks.get.mockResolvedValue({ docs: [] });
  });

  afterEach(async () => {
    vi.resetModules();
  });

  it("should initialize app successfully and register all routes", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    // Verify app is ready without errors
    await fastify.ready();

    // Verify key routes are registered
    const routes = fastify.printRoutes({ commonPrefix: false });
    expect(routes).toContain("/ (GET, HEAD)");
    expect(routes).toContain("health (GET, HEAD)");
    expect(routes).toContain("documentation");

    await fastify.close();
  });

  it("should handle requests to root endpoint", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const response = await fastify.inject({
      method: "GET",
      url: "/",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ root: true });

    await fastify.close();
  });

  it("should handle requests to health endpoint", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const response = await fastify.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("status", "healthy");

    await fastify.close();
  });

  it("should have security headers from helmet plugin", async () => {
    const { buildApp } = await import("../../src/app.js");
    const fastify = await buildApp();

    const response = await fastify.inject({
      method: "GET",
      url: "/",
    });

    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["strict-transport-security"]).toBeDefined();

    await fastify.close();
  });

  it("should handle CORS for localhost requests", async () => {
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
});
