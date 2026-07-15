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
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => mockAuth),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => mockFirestore),
}));

describe("Under Pressure Plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirestore._mocks.get.mockResolvedValue({ docs: [] });
  });

  afterEach(async () => {
    vi.resetModules();
  });

  describe("Status Route", () => {
    it("exposes /status endpoint", async () => {
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: lifecyclePlugin } = await import("../../../src/plugins/lifecycle.js");
      const { default: underPressurePlugin } = await import("../../../src/plugins/under-pressure.js");

      const fastify = Fastify();
      fastify.register(firebasePlugin);
      fastify.register(lifecyclePlugin);
      fastify.register(underPressurePlugin);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/status",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty("status", "ok");

      await fastify.close();
    });
  });

  describe("Health Check", () => {
    it("keeps the liveness route when Firestore is unavailable", async () => {
      mockFirestore._mocks.get.mockRejectedValue(new Error("Connection failed"));

      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: lifecyclePlugin } = await import("../../../src/plugins/lifecycle.js");
      const { default: underPressurePlugin } = await import("../../../src/plugins/under-pressure.js");
      const { default: healthRoutes } = await import("../../../src/routes/health.js");

      const fastify = Fastify();
      fastify.register(firebasePlugin);
      fastify.register(lifecyclePlugin);
      fastify.register(underPressurePlugin);
      fastify.register(healthRoutes);
      await fastify.ready();

      const response = await fastify.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: "healthy" });

      await fastify.close();
    });

    it("returns healthy when Firestore is accessible", async () => {
      mockFirestore._mocks.get.mockResolvedValue({ docs: [] });

      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: lifecyclePlugin } = await import("../../../src/plugins/lifecycle.js");
      const { default: underPressurePlugin } = await import("../../../src/plugins/under-pressure.js");

      const fastify = Fastify();
      fastify.register(firebasePlugin);
      fastify.register(lifecyclePlugin);
      fastify.register(underPressurePlugin);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/status",
      });

      expect(response.statusCode).toBe(200);

      await fastify.close();
    });

    it("returns unhealthy when Firestore fails", async () => {
      mockFirestore._mocks.get.mockRejectedValue(new Error("Connection failed"));

      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: lifecyclePlugin } = await import("../../../src/plugins/lifecycle.js");
      const { default: underPressurePlugin } = await import("../../../src/plugins/under-pressure.js");

      const fastify = Fastify();
      fastify.register(firebasePlugin);
      fastify.register(lifecyclePlugin);
      fastify.register(underPressurePlugin);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/status",
      });

      expect(response.statusCode).toBe(503);

      await fastify.close();
    });

    it("returns unhealthy during shutdown", async () => {
      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: lifecyclePlugin } = await import("../../../src/plugins/lifecycle.js");
      const { default: underPressurePlugin } = await import("../../../src/plugins/under-pressure.js");

      const fastify = Fastify();
      fastify.register(firebasePlugin);
      fastify.register(lifecyclePlugin);
      fastify.register(underPressurePlugin);
      await fastify.ready();

      // Simulate shutdown state
      fastify.isShuttingDown = true;

      const response = await fastify.inject({
        method: "GET",
        url: "/status",
      });

      expect(response.statusCode).toBe(503);

      await fastify.close();
    });

    it("returns unhealthy when health check times out", async () => {
      // Mock a slow Firestore response that will exceed the timeout
      mockFirestore._mocks.get.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ docs: [] }), 200)),
      );

      const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
      const { default: lifecyclePlugin } = await import("../../../src/plugins/lifecycle.js");
      const { default: underPressurePlugin } = await import("../../../src/plugins/under-pressure.js");

      const fastify = Fastify();
      fastify.register(firebasePlugin);
      fastify.register(lifecyclePlugin);
      // Set a very short timeout to trigger timeout behavior
      fastify.register(underPressurePlugin, { healthCheckTimeout: 50 });
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/status",
      });

      expect(response.statusCode).toBe(503);

      await fastify.close();
    });
  });
});
