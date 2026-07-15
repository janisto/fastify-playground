import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock, createFirestoreMock } from "../../mocks/firebase.js";

const mockApp = createFirebaseAppMock();
const mockAuth = createFirebaseAuthMock();
const mockFirestore = createFirestoreMock();

vi.mock("firebase-admin/app", () => ({
  getApps: vi.fn(() => [mockApp]),
  initializeApp: vi.fn(() => mockApp),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => mockAuth) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: vi.fn(() => mockFirestore) }));

describe("Firebase infrastructure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reuses an existing app and exposes its application services", async () => {
    const { getApps, initializeApp } = await import("firebase-admin/app");
    const { default: firebase } = await import("../../../src/plugins/firebase.js");
    const app = Fastify();
    app.register(firebase);
    await app.ready();

    expect(getApps).toHaveBeenCalledOnce();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(app.firebase).toBe(mockApp);
    expect(app.firebaseAuth).toBe(mockAuth);
    expect(app.firestore).toBe(mockFirestore);
    await app.close();
  });

  it("lets Application Default Credentials initialize a fresh app", async () => {
    const { getApps, initializeApp } = await import("firebase-admin/app");
    vi.mocked(getApps).mockReturnValueOnce([]);
    const { default: firebase } = await import("../../../src/plugins/firebase.js");
    const app = Fastify();
    app.register(firebase);
    await app.ready();

    expect(initializeApp).toHaveBeenCalledWith();
    expect(app.firebase).toBe(mockApp);
    await app.close();
  });

  it("terminates Firestore exactly once during application cleanup", async () => {
    const { default: firebase } = await import("../../../src/plugins/firebase.js");
    const app = Fastify();
    app.register(firebase);
    await app.ready();

    await app.close();

    expect(mockFirestore.terminate).toHaveBeenCalledOnce();
  });
});
