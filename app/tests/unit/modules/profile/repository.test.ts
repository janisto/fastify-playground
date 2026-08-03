import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
import { FirestoreProfileRepository } from "../../../../src/modules/profile/repository.js";

const INPUT = {
  firstName: "Ada",
  lastName: "Lovelace",
  contactEmail: "Ada@example.com",
  phoneNumber: "+358401234567",
  termsAccepted: true,
} as const;
const NOW = "2026-07-30T12:00:00.000Z";

function firestoreDouble() {
  const records = new Map<string, unknown>();
  let writes = 0;
  const doc = vi.fn((id: string) => ({
    id,
    get: async () => ({ exists: records.has(id), data: () => records.get(id) }),
  }));
  const transaction = {
    get: async (reference: { id: string }) => ({
      exists: records.has(reference.id),
      data: () => records.get(reference.id),
    }),
    create(reference: { id: string }, value: unknown) {
      if (records.has(reference.id)) throw new Error("already exists");
      records.set(reference.id, structuredClone(value));
      writes += 1;
    },
    set(reference: { id: string }, value: unknown) {
      records.set(reference.id, structuredClone(value));
      writes += 1;
    },
    delete(reference: { id: string }) {
      records.delete(reference.id);
      writes += 1;
    },
  };
  const firestore = {
    collection: vi.fn(() => ({ doc })),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  } as unknown as Firestore;
  return { firestore, doc, records, writes: () => writes };
}

describe("FirestoreProfileRepository", () => {
  it("uses an injective hardened key and conditionally creates without overwriting", async () => {
    const fixture = firestoreDouble();
    const repository = new FirestoreProfileRepository(fixture.firestore);
    const first = await repository.create("principal/one", INPUT, NOW);
    const duplicate = await repository.create("principal/one", { ...INPUT, firstName: "Eve" }, NOW);

    expect(first).toMatchObject({ id: "principal/one", marketingOptIn: false, createdAt: NOW, updatedAt: NOW });
    expect(duplicate).toBeNull();
    expect(fixture.doc).toHaveBeenCalledWith("uid_cHJpbmNpcGFsL29uZQ");
    expect(fixture.writes()).toBe(1);
  });

  it("commits a real update atomically and performs no write for a no-op", async () => {
    const fixture = firestoreDouble();
    const repository = new FirestoreProfileRepository(fixture.firestore);
    await repository.create("principal", INPUT, NOW);
    const writesAfterCreate = fixture.writes();

    const unchanged = await repository.update("principal", { contactEmail: "Ada@example.com" }, NOW);
    expect(unchanged?.updatedAt).toBe(NOW);
    expect(fixture.writes()).toBe(writesAfterCreate);

    const changed = await repository.update("principal", { marketingOptIn: true }, NOW);
    expect(changed).toMatchObject({ marketingOptIn: true, createdAt: NOW, updatedAt: "2026-07-30T12:00:00.001Z" });
    expect(fixture.writes()).toBe(writesAfterCreate + 1);
  });

  it("returns definitive missing results and delete outcomes without resurrection", async () => {
    const fixture = firestoreDouble();
    const repository = new FirestoreProfileRepository(fixture.firestore);
    expect(await repository.get("missing")).toBeNull();
    expect(await repository.update("missing", { firstName: "Ada" }, NOW)).toBeNull();
    expect(await repository.delete("missing")).toBe(false);
    await repository.create("principal", INPUT, NOW);
    expect(await repository.delete("principal")).toBe(true);
    expect(await repository.get("principal")).toBeNull();
  });

  it("classifies corrupt stored data as internal and provider failure as dependency unavailable", async () => {
    const corrupt = firestoreDouble();
    const corruptRepository = new FirestoreProfileRepository(corrupt.firestore);
    await corruptRepository.create("principal", INPUT, NOW);
    const key = corrupt.doc.mock.calls.at(-1)?.[0];
    if (typeof key !== "string") throw new Error("missing document key");
    corrupt.records.set(key, { id: "principal", private: "corrupt" });
    await expect(corruptRepository.get("principal")).rejects.toMatchObject({ code: "internal_error" });

    const provider = firestoreDouble();
    vi.mocked(provider.firestore.runTransaction).mockRejectedValueOnce(new Error("private provider canary"));
    await expect(
      new FirestoreProfileRepository(provider.firestore).create("principal", INPUT, NOW),
    ).rejects.toMatchObject({
      code: "dependency_unavailable",
    });
  });
});
