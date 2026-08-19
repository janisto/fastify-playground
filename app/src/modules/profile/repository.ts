import { Buffer } from "node:buffer";
import type { Firestore } from "firebase-admin/firestore";
import { TIMESTAMP_PATTERN } from "../../schemas/portable.js";
import { PortableError } from "../../utils/portable-error.js";
import type { Profile, ProfileCreate, ProfileUpdate } from "./schemas.js";

const PROFILE_COLLECTION = "profiles";
const TIMESTAMP_REGEX = new RegExp(TIMESTAMP_PATTERN);
const MAX_TIMESTAMP = "9999-12-31T23:59:59.999Z";

export interface ProfileRepository {
  create(id: string, input: ProfileCreate, now: string, signal?: AbortSignal): Promise<Profile | null>;
  get(id: string, signal?: AbortSignal): Promise<Profile | null>;
  update(id: string, input: ProfileUpdate, now: string, signal?: AbortSignal): Promise<Profile | null>;
  delete(id: string, signal?: AbortSignal): Promise<boolean>;
}

function profileDocumentId(id: string): string {
  return `uid_${Buffer.from(id).toString("base64url")}`;
}

function isCanonicalTimestamp(value: unknown): value is string {
  return typeof value === "string" && TIMESTAMP_REGEX.test(value) && new Date(value).toISOString() === value;
}

function isProfile(value: unknown, expectedId: string): value is Profile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 9 &&
    record["id"] === expectedId &&
    typeof record["firstName"] === "string" &&
    typeof record["lastName"] === "string" &&
    typeof record["contactEmail"] === "string" &&
    typeof record["phoneNumber"] === "string" &&
    typeof record["marketingOptIn"] === "boolean" &&
    record["termsAccepted"] === true &&
    isCanonicalTimestamp(record["createdAt"]) &&
    isCanonicalTimestamp(record["updatedAt"]) &&
    record["updatedAt"] >= record["createdAt"]
  );
}

function decodeProfile(value: unknown, id: string): Profile {
  if (!isProfile(value, id)) throw new PortableError("internal_error");
  return value;
}

function nextUpdatedAt(previous: string, now: string): string {
  if (now > previous) return now;
  if (previous === MAX_TIMESTAMP) throw new PortableError("internal_error");
  const next = new Date(new Date(previous).getTime() + 1).toISOString();
  if (!isCanonicalTimestamp(next)) throw new PortableError("internal_error");
  return next;
}

function applyUpdate(profile: Profile, input: ProfileUpdate, now: string): Profile | null {
  const changed = (Object.entries(input) as [keyof ProfileUpdate, ProfileUpdate[keyof ProfileUpdate]][]).some(
    ([key, value]) => profile[key] !== value,
  );
  if (!changed) return null;
  return { ...profile, ...input, updatedAt: nextUpdatedAt(profile.updatedAt, now) };
}

function dependencyError(error: unknown, signal?: AbortSignal): PortableError {
  signal?.throwIfAborted();
  if (error instanceof PortableError) return error;
  return new PortableError("dependency_unavailable", { cause: error });
}

export class FirestoreProfileRepository implements ProfileRepository {
  private readonly firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  async create(id: string, input: ProfileCreate, now: string, signal?: AbortSignal): Promise<Profile | null> {
    try {
      signal?.throwIfAborted();
      const reference = this.firestore.collection(PROFILE_COLLECTION).doc(profileDocumentId(id));
      const result = await this.firestore.runTransaction(async (transaction) => {
        signal?.throwIfAborted();
        const snapshot = await transaction.get(reference);
        signal?.throwIfAborted();
        if (snapshot.exists) return null;
        const profile: Profile = {
          id,
          ...input,
          marketingOptIn: input.marketingOptIn ?? false,
          createdAt: now,
          updatedAt: now,
        };
        transaction.create(reference, profile);
        return profile;
      });
      signal?.throwIfAborted();
      return result;
    } catch (error) {
      throw dependencyError(error, signal);
    }
  }

  async get(id: string, signal?: AbortSignal): Promise<Profile | null> {
    try {
      signal?.throwIfAborted();
      const snapshot = await this.firestore.collection(PROFILE_COLLECTION).doc(profileDocumentId(id)).get();
      signal?.throwIfAborted();
      return snapshot.exists ? decodeProfile(snapshot.data(), id) : null;
    } catch (error) {
      throw dependencyError(error, signal);
    }
  }

  async update(id: string, input: ProfileUpdate, now: string, signal?: AbortSignal): Promise<Profile | null> {
    try {
      signal?.throwIfAborted();
      const reference = this.firestore.collection(PROFILE_COLLECTION).doc(profileDocumentId(id));
      const result = await this.firestore.runTransaction(async (transaction) => {
        signal?.throwIfAborted();
        const snapshot = await transaction.get(reference);
        signal?.throwIfAborted();
        if (!snapshot.exists) return null;
        const profile = decodeProfile(snapshot.data(), id);
        const updated = applyUpdate(profile, input, now);
        if (updated === null) return profile;
        transaction.set(reference, updated);
        return updated;
      });
      signal?.throwIfAborted();
      return result;
    } catch (error) {
      throw dependencyError(error, signal);
    }
  }

  async delete(id: string, signal?: AbortSignal): Promise<boolean> {
    try {
      signal?.throwIfAborted();
      const reference = this.firestore.collection(PROFILE_COLLECTION).doc(profileDocumentId(id));
      const result = await this.firestore.runTransaction(async (transaction) => {
        signal?.throwIfAborted();
        const snapshot = await transaction.get(reference);
        signal?.throwIfAborted();
        if (!snapshot.exists) return false;
        transaction.delete(reference);
        return true;
      });
      signal?.throwIfAborted();
      return result;
    } catch (error) {
      throw dependencyError(error, signal);
    }
  }
}

export function createLazyFirestoreProfileRepository(factory: () => Firestore): ProfileRepository {
  let repository: FirestoreProfileRepository | undefined;
  const current = () => {
    try {
      repository ??= new FirestoreProfileRepository(factory());
      return repository;
    } catch (error) {
      throw dependencyError(error);
    }
  };
  return {
    create: (...arguments_) => current().create(...arguments_),
    get: (...arguments_) => current().get(...arguments_),
    update: (...arguments_) => current().update(...arguments_),
    delete: (...arguments_) => current().delete(...arguments_),
  };
}
