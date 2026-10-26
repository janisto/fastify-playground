import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock } from "../../mocks/firebase.js";

const mockApp = createFirebaseAppMock();
const mockAuth = createFirebaseAuthMock();

vi.mock("firebase-admin/app", () => ({
  deleteApp: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn() }));

describe("Firebase infrastructure", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", undefined);
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", undefined);
    vi.stubEnv("FIREBASE_PROJECT_ID", undefined);
    vi.stubEnv("NODE_ENV", "test");
    const { deleteApp, getApps, initializeApp } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    vi.mocked(deleteApp).mockResolvedValue(undefined);
    vi.mocked(getApps).mockReturnValue([mockApp as unknown as ReturnType<typeof getApps>[number]]);
    vi.mocked(initializeApp).mockReturnValue(mockApp as unknown as ReturnType<typeof initializeApp>);
    vi.mocked(getAuth).mockReturnValue(mockAuth as unknown as ReturnType<typeof getAuth>);
  });

  it("reuses the existing default app without assuming ownership", async () => {
    const { deleteApp, getApps, initializeApp } = await import("firebase-admin/app");
    const { default: firebase } = await import("../../../src/plugins/firebase.js");
    const app = Fastify();
    app.register(firebase);
    await app.ready();

    expect(getApps).toHaveBeenCalledOnce();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(app.firebaseAuth).toBe(mockAuth);
    await app.close();
    expect(deleteApp).not.toHaveBeenCalled();
  });

  it("keeps concurrent application factories isolated when no external default app exists", async () => {
    const { deleteApp, getApps, initializeApp } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    type FirebaseApp = ReturnType<typeof initializeApp>;
    const registry: FirebaseApp[] = [];

    vi.mocked(getApps).mockImplementation(() => registry);
    vi.mocked(initializeApp).mockImplementation((_options, name = "[DEFAULT]") => {
      const existing = registry.find((candidate) => candidate.name === name);
      if (existing) return existing;

      const app = createFirebaseAppMock(name) as unknown as FirebaseApp;
      registry.push(app);
      return app;
    });
    vi.mocked(deleteApp).mockImplementation(async (app) => {
      const index = registry.indexOf(app);
      if (index >= 0) registry.splice(index, 1);
    });
    vi.mocked(getAuth).mockImplementation((app) => {
      if (app === undefined) throw new Error("expected an explicit Firebase app");
      const auth = createFirebaseAuthMock();
      Object.defineProperty(auth, "app", {
        enumerable: true,
        get() {
          if (!registry.includes(app)) throw new Error(`Firebase app '${app.name}' has been deleted`);
          return app;
        },
      });
      return auth as unknown as ReturnType<typeof getAuth>;
    });

    const { default: firebase } = await import("../../../src/plugins/firebase.js");
    const first = Fastify();
    const second = Fastify();
    first.register(firebase);
    second.register(firebase);
    await Promise.all([first.ready(), second.ready()]);

    const initializedNames = vi.mocked(initializeApp).mock.calls.map((call) => call[1]);
    expect(initializedNames).toHaveLength(2);
    expect(new Set(initializedNames).size).toBe(2);
    expect(initializedNames.every((name) => name?.startsWith("fastify-playground-") === true)).toBe(true);

    const firstOwnedApp = first.firebaseAuth.app;
    const secondOwnedApp = second.firebaseAuth.app;
    await first.close();

    expect(deleteApp).toHaveBeenCalledOnce();
    expect(deleteApp).toHaveBeenCalledWith(firstOwnedApp);
    expect(second.firebaseAuth.app).toBe(secondOwnedApp);

    await second.close();
    expect(deleteApp).toHaveBeenCalledTimes(2);
    expect(deleteApp).toHaveBeenLastCalledWith(secondOwnedApp);
    expect(registry).toHaveLength(0);
  });

  it("surfaces cleanup failure for an app the plugin owns", async () => {
    const { deleteApp, getApps } = await import("firebase-admin/app");
    vi.mocked(getApps).mockReturnValueOnce([]);
    vi.mocked(deleteApp).mockRejectedValueOnce(new Error("cleanup failure canary"));
    const { default: firebase } = await import("../../../src/plugins/firebase.js");
    const app = Fastify();
    app.register(firebase);
    await app.ready();

    await expect(app.close()).rejects.toThrow("cleanup failure canary");
    expect(deleteApp).toHaveBeenCalledOnce();
  });

  it("releases an owned app when Auth client initialization fails", async () => {
    const { deleteApp, getApps } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    vi.mocked(getApps).mockReturnValueOnce([]);
    vi.mocked(getAuth).mockImplementationOnce(() => {
      throw new Error("auth initialization canary");
    });
    const { default: firebase } = await import("../../../src/plugins/firebase.js");
    const app = Fastify();
    app.register(firebase);

    await expect(app.ready()).rejects.toThrow("auth initialization canary");
    await app.close();

    expect(deleteApp).toHaveBeenCalledOnce();
    expect(deleteApp).toHaveBeenCalledWith(mockApp);
  });
});

describe("Firebase emulator safety", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["production", "production", "127.0.0.1:7010", "127.0.0.1:7030", "demo-test"],
    ["missing Auth", "test", undefined, "127.0.0.1:7030", "demo-test"],
    ["missing Firestore", "test", "127.0.0.1:7010", undefined, "demo-test"],
    ["cloud project", "test", "127.0.0.1:7010", "127.0.0.1:7030", "real-project"],
    ["remote endpoint", "test", "auth.example:7010", "127.0.0.1:7030", "demo-test"],
    ["scheme", "test", "http://127.0.0.1:7010", "127.0.0.1:7030", "demo-test"],
    ["userinfo", "test", "user@127.0.0.1:7010", "127.0.0.1:7030", "demo-test"],
    ["path", "test", "127.0.0.1:7010/path", "127.0.0.1:7030", "demo-test"],
    ["invalid address", "test", "127.999.0.1:7010", "127.0.0.1:7030", "demo-test"],
    ["missing port", "test", "localhost", "127.0.0.1:7030", "demo-test"],
    ["zero port", "test", "localhost:0", "127.0.0.1:7030", "demo-test"],
    ["overflow port", "test", "localhost:65536", "127.0.0.1:7030", "demo-test"],
    ["whitespace", "test", "localhost:7010 ", "127.0.0.1:7030", "demo-test"],
  ])("rejects %s before SDK initialization", async (_case, mode, auth, firestore, project) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", auth);
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", firestore);
    vi.stubEnv("FIREBASE_PROJECT_ID", project);
    const { default: firebase } = await import("../../../src/plugins/firebase.js");
    const { getApps, initializeApp } = await import("firebase-admin/app");
    const app = Fastify();
    app.register(firebase);
    await expect(app.ready()).rejects.toThrow("Firebase emulators require");
    await app.close();
    expect(getApps).not.toHaveBeenCalled();
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it.each(["127.0.0.1", "127.0.1.2", "localhost", "[::1]"])("uses explicit demo project for %s", async (host) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", `${host}:7010`);
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", `${host}:7030`);
    vi.stubEnv("FIREBASE_PROJECT_ID", "demo-test");
    const { firebaseOptions } = await import("../../../src/plugins/firebase.js");
    expect(firebaseOptions()).toEqual({ projectId: "demo-test" });
  });
  it("rejects a conflicting external default app without assuming ownership", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:7010");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:7030");
    vi.stubEnv("FIREBASE_PROJECT_ID", "demo-test");
    const { getApps, initializeApp, deleteApp } = await import("firebase-admin/app");
    const external = { ...mockApp, options: { projectId: "other-project" } };
    vi.mocked(getApps).mockReturnValue([external as unknown as ReturnType<typeof getApps>[number]]);
    const { default: firebase } = await import("../../../src/plugins/firebase.js");
    const app = Fastify();
    app.register(firebase);
    await expect(app.ready()).rejects.toThrow("existing Firebase app");
    await app.close();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(deleteApp).not.toHaveBeenCalled();
  });
});
