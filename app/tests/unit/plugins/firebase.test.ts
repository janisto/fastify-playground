import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(async () => {
    vi.clearAllMocks();
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
