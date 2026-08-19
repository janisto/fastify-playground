import { Buffer } from "node:buffer";
import { decode as cborDecode, encode as cborEncode } from "cbor2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileRepository } from "../../src/modules/profile/repository.js";
import type { Profile, ProfileCreate, ProfileUpdate } from "../../src/modules/profile/schemas.js";
import { PortableError } from "../../src/utils/portable-error.js";
import { createFirebaseAppMock, createFirebaseAuthMock } from "../mocks/firebase.js";

const firebaseApp = createFirebaseAppMock();
const firebaseAuth = createFirebaseAuthMock();

vi.mock("firebase-admin/app", () => ({
  deleteApp: vi.fn().mockResolvedValue(undefined),
  getApps: vi.fn(() => [firebaseApp]),
  initializeApp: vi.fn(() => firebaseApp),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => firebaseAuth) }));

function clone<T>(value: T): T {
  return structuredClone(value);
}

class DeterministicProfileRepository implements ProfileRepository {
  readonly records = new Map<string, Profile>();
  calls = 0;
  committedWrites = 0;
  failure: Error | undefined;
  createGate: Promise<void> | undefined;

  async create(id: string, input: ProfileCreate, now: string): Promise<Profile | null> {
    this.calls += 1;
    if (this.failure) throw this.failure;
    await this.createGate;
    if (this.records.has(id)) return null;
    const profile: Profile = {
      id,
      ...clone(input),
      marketingOptIn: input.marketingOptIn ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(id, profile);
    this.committedWrites += 1;
    return clone(profile);
  }

  async get(id: string): Promise<Profile | null> {
    this.calls += 1;
    if (this.failure) throw this.failure;
    const profile = this.records.get(id);
    return profile === undefined ? null : clone(profile);
  }

  async update(id: string, input: ProfileUpdate, now: string): Promise<Profile | null> {
    this.calls += 1;
    if (this.failure) throw this.failure;
    const current = this.records.get(id);
    if (!current) return null;
    const changed = Object.entries(input).some(([key, value]) => current[key as keyof Profile] !== value);
    if (!changed) return clone(current);
    const updatedAt = now > current.updatedAt ? now : new Date(new Date(current.updatedAt).getTime() + 1).toISOString();
    const updated = { ...current, ...clone(input), updatedAt };
    this.records.set(id, updated);
    this.committedWrites += 1;
    return clone(updated);
  }

  async delete(id: string): Promise<boolean> {
    this.calls += 1;
    if (this.failure) throw this.failure;
    const deleted = this.records.delete(id);
    if (deleted) this.committedWrites += 1;
    return deleted;
  }
}

const CREATE_BODY = {
  firstName: "Ada",
  lastName: "Lovelace",
  contactEmail: "  Ada@EXAMPLE.COM\t",
  phoneNumber: " +358401234567 ",
  termsAccepted: true,
} as const;

describe("GCP current-principal profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "silent");
    vi.stubEnv("CORS_ORIGINS", "");
    firebaseAuth.verifyIdToken.mockImplementation(async (token: string) => ({ uid: token }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("executes normalized CRUD, isolates two principals, and preserves no-op timestamps", async () => {
    const repository = new DeterministicProfileRepository();
    const instants = [
      new Date("2026-07-30T12:00:00.123Z"),
      new Date("2026-07-30T12:00:00.123Z"),
      new Date("2026-07-30T12:00:00.123Z"),
      new Date("2026-07-30T12:05:00.456Z"),
    ];
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp({ profileRepository: repository, profileClock: () => instants.shift() ?? new Date(0) });

    const created = await app.inject({
      method: "POST",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one", "content-type": "application/json" },
      payload: JSON.stringify(CREATE_BODY),
    });
    expect(created.statusCode).toBe(201);
    expect(created.headers.location).toBe("/v1/profile");
    expect(created.json()).toEqual({
      id: "user-one",
      firstName: "Ada",
      lastName: "Lovelace",
      contactEmail: "Ada@example.com",
      phoneNumber: "+358401234567",
      marketingOptIn: false,
      termsAccepted: true,
      createdAt: "2026-07-30T12:00:00.123Z",
      updatedAt: "2026-07-30T12:00:00.123Z",
    });

    const other = await app.inject({
      method: "GET",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-two" },
    });
    expect(other.json()).toMatchObject({ status: 404, code: "profile_not_found" });

    const writesAfterCreate = repository.committedWrites;
    const duplicate = await app.inject({
      method: "POST",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one", "content-type": "application/json" },
      payload: JSON.stringify({ ...CREATE_BODY, firstName: "Overwrite" }),
    });
    expect(duplicate.json()).toMatchObject({ status: 409, code: "profile_exists" });
    expect(repository.committedWrites).toBe(writesAfterCreate);
    expect(repository.records.get("user-one")?.firstName).toBe("Ada");

    const noOp = await app.inject({
      method: "PATCH",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one", accept: "application/cbor", "content-type": "application/cbor" },
      payload: Buffer.from(cborEncode({ contactEmail: "Ada@EXAMPLE.COM" })),
    });
    expect(noOp.statusCode).toBe(200);
    expect(cborDecode(noOp.rawPayload)).toMatchObject({ updatedAt: "2026-07-30T12:00:00.123Z" });
    expect(repository.committedWrites).toBe(writesAfterCreate);

    const changed = await app.inject({
      method: "PATCH",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one", "content-type": "application/json" },
      payload: JSON.stringify({ marketingOptIn: true }),
    });
    expect(changed.json()).toMatchObject({
      marketingOptIn: true,
      createdAt: "2026-07-30T12:00:00.123Z",
      updatedAt: "2026-07-30T12:05:00.456Z",
    });

    const deleted = await app.inject({
      method: "DELETE",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one", accept: "text/html" },
    });
    expect(deleted.statusCode).toBe(204);
    expect(deleted.body).toBe("");
    expect(deleted.headers["content-type"]).toBeUndefined();
    const missing = await app.inject({
      method: "DELETE",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one" },
    });
    expect(missing.json()).toMatchObject({ status: 404, code: "profile_not_found" });
    await app.close();
  });

  it("rejects authentication, query, and complete-body failures before persistence", async () => {
    const repository = new DeterministicProfileRepository();
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp({ profileRepository: repository });

    const unauthenticated = await app.inject({ method: "POST", url: "/v1/profile?owner=other" });
    expect(unauthenticated.statusCode).toBe(400);
    expect(firebaseAuth.verifyIdToken).not.toHaveBeenCalled();
    expect(repository.calls).toBe(0);

    const oversized = await app.inject({
      method: "POST",
      url: "/v1/profile",
      headers: {
        authorization: "Bearer user-one",
        "content-type": "application/json",
        "content-length": "1000001",
      },
      payload: "{}",
    });
    expect(oversized.json()).toMatchObject({ status: 413, code: "payload_too_large" });
    expect(firebaseAuth.verifyIdToken).not.toHaveBeenCalled();
    expect(repository.calls).toBe(0);

    const invalid = await app.inject({
      method: "POST",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one", "content-type": "application/json" },
      payload: '{"firstName":"Ada","firstName":"Eve"}',
    });
    expect(invalid.json()).toMatchObject({ status: 400, code: "invalid_request" });
    expect(repository.calls).toBe(0);

    const semantic = await app.inject({
      method: "PATCH",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one", "content-type": "application/json" },
      payload: JSON.stringify({ id: "other" }),
    });
    expect(semantic.json()).toMatchObject({ status: 422, code: "validation_failed" });
    expect(repository.calls).toBe(0);

    const prototypeMember = await app.inject({
      method: "POST",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one", "content-type": "application/json" },
      payload:
        '{"firstName":"Ada","lastName":"Lovelace","contactEmail":"Ada@example.com","phoneNumber":"+358401234567","termsAccepted":true,"__proto__":{"marketingOptIn":true}}',
    });
    expect(prototypeMember.json()).toMatchObject({ status: 422, code: "validation_failed" });
    expect(repository.calls).toBe(0);
    await app.close();
  });

  it.each([
    ".Ada@example.com",
    "Ada.@example.com",
    "Ada..Lovelace@example.com",
    "Ada@localhost",
    `${"a".repeat(65)}@example.com`,
  ])("rejects non-portable contact email %s before persistence", async (contactEmail) => {
    const repository = new DeterministicProfileRepository();
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp({ profileRepository: repository });
    const response = await app.inject({
      method: "POST",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one", "content-type": "application/json" },
      payload: JSON.stringify({ ...CREATE_BODY, contactEmail }),
    });
    expect(response.json()).toMatchObject({ status: 422, code: "validation_failed" });
    expect(repository.calls).toBe(0);
    await app.close();
  });

  it("synchronizes concurrent creates into one 201, one 409, and one committed winner", async () => {
    const repository = new DeterministicProfileRepository();
    const gate = Promise.withResolvers<void>();
    repository.createGate = gate.promise;
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp({
      profileRepository: repository,
      profileClock: () => new Date("2026-07-30T12:00:00.000Z"),
    });
    const create = (firstName: string) =>
      app.inject({
        method: "POST",
        url: "/v1/profile",
        headers: { authorization: "Bearer racing-user", "content-type": "application/json" },
        payload: JSON.stringify({ ...CREATE_BODY, firstName }),
      });
    const first = create("First");
    const second = create("Second");
    await vi.waitFor(() => expect(repository.calls).toBe(2));
    gate.resolve();
    const responses = await Promise.all([first, second]);

    expect(responses.map(({ statusCode }) => statusCode).toSorted()).toEqual([201, 409]);
    expect(repository.committedWrites).toBe(1);
    expect(["First", "Second"]).toContain(repository.records.get("racing-user")?.firstName);
    await app.close();
  });

  it("maps persistence failure to safe 503 without a false success", async () => {
    const repository = new DeterministicProfileRepository();
    repository.failure = new PortableError("dependency_unavailable", { cause: new Error("private Firestore canary") });
    const { buildApp } = await import("../../src/app.js");
    const app = await buildApp({ profileRepository: repository });
    const response = await app.inject({
      method: "GET",
      url: "/v1/profile",
      headers: { authorization: "Bearer user-one" },
    });
    expect(response.json()).toMatchObject({ status: 503, code: "dependency_unavailable" });
    expect(response.payload).not.toContain("private Firestore canary");
    expect(repository.committedWrites).toBe(0);
    await app.close();
  });
});
