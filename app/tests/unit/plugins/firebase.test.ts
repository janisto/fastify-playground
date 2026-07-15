import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock } from "../../mocks/firebase.js";

const mockApp = createFirebaseAppMock();
const mockAuth = createFirebaseAuthMock();

vi.mock("firebase-admin/app", () => ({
  deleteApp: vi.fn().mockResolvedValue(undefined),
  getApps: vi.fn(() => [mockApp]),
  initializeApp: vi.fn(() => mockApp),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => mockAuth) }));

describe("Firebase infrastructure", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("initializes and deletes an owned default app while preserving unrelated named apps", async () => {
    const { deleteApp, getApps, initializeApp } = await import("firebase-admin/app");
    vi.mocked(getApps).mockReturnValueOnce([
      createFirebaseAppMock("other") as unknown as ReturnType<typeof getApps>[number],
    ]);
    const { default: firebase } = await import("../../../src/plugins/firebase.js");
    const app = Fastify();
    app.register(firebase);
    await app.ready();

    expect(initializeApp).toHaveBeenCalledWith();
    expect(app.firebaseAuth).toBe(mockAuth);
    await app.close();
    expect(deleteApp).toHaveBeenCalledOnce();
    expect(deleteApp).toHaveBeenCalledWith(mockApp);
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
});
