import { PortableError } from "../../utils/portable-error.js";
import type { ProfileRepository } from "./repository.js";
import type { Profile, ProfileCreate, ProfileUpdate } from "./schemas.js";

export type ProfileClock = () => Date;

function canonicalNow(clock: ProfileClock): string {
  const value = clock();
  const timestamp = value.toISOString();
  if (!/^[0-9]{4}-/.test(timestamp)) throw new PortableError("internal_error");
  return timestamp;
}

export class ProfileService {
  private readonly repository: ProfileRepository;
  private readonly clock: ProfileClock;

  constructor(repository: ProfileRepository, clock: ProfileClock = () => new Date()) {
    this.repository = repository;
    this.clock = clock;
  }

  async create(id: string, input: ProfileCreate, signal?: AbortSignal): Promise<Profile> {
    const profile = await this.repository.create(id, input, canonicalNow(this.clock), signal);
    if (profile === null) throw new PortableError("profile_exists");
    return profile;
  }

  async get(id: string, signal?: AbortSignal): Promise<Profile> {
    const profile = await this.repository.get(id, signal);
    if (profile === null) throw new PortableError("profile_not_found");
    return profile;
  }

  async update(id: string, input: ProfileUpdate, signal?: AbortSignal): Promise<Profile> {
    const profile = await this.repository.update(id, input, canonicalNow(this.clock), signal);
    if (profile === null) throw new PortableError("profile_not_found");
    return profile;
  }

  async delete(id: string, signal?: AbortSignal): Promise<void> {
    if (!(await this.repository.delete(id, signal))) throw new PortableError("profile_not_found");
  }
}
