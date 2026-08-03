import { describe, expect, it, vi } from "vitest";
import type { ProfileRepository } from "../../../../src/modules/profile/repository.js";
import { ProfileService } from "../../../../src/modules/profile/service.js";

const repository = (): ProfileRepository => ({
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});

describe("ProfileService", () => {
  it("uses the default clock and maps a create conflict", async () => {
    const repo = repository();
    vi.mocked(repo.create).mockResolvedValueOnce(null);
    await expect(
      new ProfileService(repo).create("principal", {
        firstName: "Ada",
        lastName: "Lovelace",
        contactEmail: "Ada@example.com",
        phoneNumber: "+358401234567",
        termsAccepted: true,
      }),
    ).rejects.toMatchObject({ code: "profile_exists" });
  });

  it("maps missing read, update, and delete outcomes independently", async () => {
    const repo = repository();
    vi.mocked(repo.get).mockResolvedValueOnce(null);
    vi.mocked(repo.update).mockResolvedValueOnce(null);
    vi.mocked(repo.delete).mockResolvedValueOnce(false);
    const service = new ProfileService(repo, () => new Date("2026-01-01T00:00:00.000Z"));

    await expect(service.get("principal")).rejects.toMatchObject({ code: "profile_not_found" });
    await expect(service.update("principal", { firstName: "Ada" })).rejects.toMatchObject({
      code: "profile_not_found",
    });
    await expect(service.delete("principal")).rejects.toMatchObject({ code: "profile_not_found" });
  });
});
