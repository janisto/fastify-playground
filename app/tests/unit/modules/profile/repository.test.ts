import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
import {
  createLazyFirestoreProfileRepository,
  FirestoreProfileRepository,
} from "../../../../src/modules/profile/repository.js";

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

function controlledTransactionDouble(exists: boolean) {
  const readStarted = Promise.withResolvers<void>();
  const releaseRead = Promise.withResolvers<void>();
  const stored = {
    id: "principal",
    ...INPUT,
    marketingOptIn: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const transaction = {
    get: vi.fn(async () => {
      readStarted.resolve();
      await releaseRead.promise;
      return { exists, data: () => stored };
    }),
    create: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
  const firestore = {
    collection: vi.fn(() => ({ doc: vi.fn(() => ({})) })),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  } as unknown as Firestore;
  return { firestore, readStarted, releaseRead, transaction };
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

  it.each([
    ["empty first name", "firstName", ""],
    ["name with surrounding whitespace", "lastName", "Lovelace "],
    ["malformed contact email", "contactEmail", "not-an-email"],
    ["non-E.164 phone number", "phoneNumber", "0401234567"],
  ] as const)("classifies a persisted profile with %s as corrupt", async (_case, field, value) => {
    const fixture = firestoreDouble();
    const repository = new FirestoreProfileRepository(fixture.firestore);
    await repository.create("principal", INPUT, NOW);
    const key = fixture.doc.mock.calls.at(-1)?.[0];
    if (typeof key !== "string") throw new Error("missing document key");
    const stored = fixture.records.get(key);
    if (typeof stored !== "object" || stored === null) throw new Error("missing stored profile");
    fixture.records.set(key, { ...stored, [field]: value });

    await expect(repository.get("principal")).rejects.toMatchObject({ code: "internal_error" });
  });

  it("rejects a no-op update against semantically corrupt persisted data without writing", async () => {
    const fixture = firestoreDouble();
    const repository = new FirestoreProfileRepository(fixture.firestore);
    await repository.create("principal", INPUT, NOW);
    const key = fixture.doc.mock.calls.at(-1)?.[0];
    if (typeof key !== "string") throw new Error("missing document key");
    const stored = fixture.records.get(key);
    if (typeof stored !== "object" || stored === null) throw new Error("missing stored profile");
    fixture.records.set(key, { ...stored, contactEmail: "not-an-email" });
    const writesBeforeUpdate = fixture.writes();

    await expect(repository.update("principal", { firstName: "Ada" }, NOW)).rejects.toMatchObject({
      code: "internal_error",
    });
    expect(fixture.writes()).toBe(writesBeforeUpdate);
  });

  it("maps lazy Firestore initialization failure and retries without poisoning the repository", async () => {
    const fixture = firestoreDouble();
    const factory = vi
      .fn<() => Firestore>()
      .mockImplementationOnce(() => {
        throw new Error("private initialization canary");
      })
      .mockReturnValueOnce(fixture.firestore);
    const repository = createLazyFirestoreProfileRepository(factory);

    await expect(Promise.resolve().then(() => repository.get("principal"))).rejects.toMatchObject({
      code: "dependency_unavailable",
      statusCode: 503,
    });
    await expect(repository.get("principal")).resolves.toBeNull();
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it.each(["create", "update", "delete"] as const)(
    "preserves cancellation and queues no %s write when the transaction read completes after abort",
    async (operation) => {
      const fixture = controlledTransactionDouble(operation !== "create");
      const repository = new FirestoreProfileRepository(fixture.firestore);
      const controller = new AbortController();
      const cancellation = new Error("request canceled");
      const pending =
        operation === "create"
          ? repository.create("principal", INPUT, NOW, controller.signal)
          : operation === "update"
            ? repository.update("principal", { firstName: "Grace" }, NOW, controller.signal)
            : repository.delete("principal", controller.signal);

      await fixture.readStarted.promise;
      controller.abort(cancellation);
      fixture.releaseRead.resolve();

      await expect(pending).rejects.toBe(cancellation);
      expect(fixture.transaction.create).not.toHaveBeenCalled();
      expect(fixture.transaction.set).not.toHaveBeenCalled();
      expect(fixture.transaction.delete).not.toHaveBeenCalled();
    },
  );

  it("does not start a delayed transaction attempt after cancellation", async () => {
    const attemptScheduled = Promise.withResolvers<void>();
    const startAttempt = Promise.withResolvers<void>();
    const transaction = {
      get: vi.fn(async () => ({ exists: false })),
      create: vi.fn(),
    };
    const firestore = {
      collection: vi.fn(() => ({ doc: vi.fn(() => ({})) })),
      runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => {
        attemptScheduled.resolve();
        await startAttempt.promise;
        return callback(transaction);
      }),
    } as unknown as Firestore;
    const repository = new FirestoreProfileRepository(firestore);
    const controller = new AbortController();
    const cancellation = new Error("request canceled before retry");
    const pending = repository.create("principal", INPUT, NOW, controller.signal);

    await attemptScheduled.promise;
    controller.abort(cancellation);
    startAttempt.resolve();

    await expect(pending).rejects.toBe(cancellation);
    expect(transaction.get).not.toHaveBeenCalled();
    expect(transaction.create).not.toHaveBeenCalled();
  });
});
