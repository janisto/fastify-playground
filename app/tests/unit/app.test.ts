import fp from "fastify-plugin";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock } from "../mocks/firebase.js";

const mockApp = createFirebaseAppMock("fastify-playground-startup-test");
const mockAuth = createFirebaseAuthMock();

vi.mock("firebase-admin/app", () => ({
  deleteApp: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn() }));
vi.mock("../../src/plugins/under-pressure.js", () => ({
  default: fp(
    async () => {
      throw new Error("post-firebase startup canary");
    },
    { name: "@test/failing-under-pressure", fastify: "5.x" },
  ),
}));

describe("application startup failure", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { deleteApp, getApps, initializeApp } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    vi.mocked(deleteApp).mockResolvedValue(undefined);
    vi.mocked(getApps).mockReturnValue([]);
    vi.mocked(initializeApp).mockReturnValue(mockApp as unknown as ReturnType<typeof initializeApp>);
    vi.mocked(getAuth).mockReturnValue(mockAuth as unknown as ReturnType<typeof getAuth>);
  });

  it("releases owned Firebase resources when a later plugin fails", async () => {
    const { deleteApp } = await import("firebase-admin/app");
    const { buildApp } = await import("../../src/app.js");

    await expect(buildApp()).rejects.toThrow("post-firebase startup canary");

    expect(deleteApp).toHaveBeenCalledOnce();
    expect(deleteApp).toHaveBeenCalledWith(mockApp);
  });

  it("preserves startup and cleanup failures when both operations fail", async () => {
    const { deleteApp } = await import("firebase-admin/app");
    vi.mocked(deleteApp).mockRejectedValueOnce(new Error("startup cleanup canary"));
    const { buildApp } = await import("../../src/app.js");

    const operation = buildApp();

    await expect(operation).rejects.toMatchObject({
      message: "Application startup failed and cleanup did not complete",
      errors: [
        expect.objectContaining({ message: "post-firebase startup canary" }),
        expect.objectContaining({ message: "startup cleanup canary" }),
      ],
    });
  });
});
