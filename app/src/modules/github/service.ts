import { type Cursor, decodeCursor, encodeCursor, InvalidCursorError } from "../../utils/pagination.js";

import { GitHubClient } from "./client.js";
import type {
  GitHubActivity,
  GitHubLanguage,
  GitHubOwner,
  GitHubRepo,
  GitHubRepoDetail,
  GitHubTag,
} from "./schemas.js";

const DEFAULT_OWNER = "octocat";
const DEFAULT_REPO = "git-consortium";
const ACTIVITY_CURSOR_TYPE = "gh-activity";

export interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}

export class GitHubService {
  private readonly client: GitHubClient;

  constructor(client = new GitHubClient()) {
    this.client = client;
  }

  async getOwner(owner?: string, signal?: AbortSignal): Promise<GitHubOwner> {
    return this.client.getOwner(owner ?? DEFAULT_OWNER, signal);
  }

  async listOwnerRepos(owner?: string, signal?: AbortSignal): Promise<{ repos: GitHubRepo[]; count: number }> {
    const repos = await this.client.listOwnerRepos(owner ?? DEFAULT_OWNER, 30, signal);
    return { repos, count: repos.length };
  }

  async getRepo(owner?: string, repo?: string, signal?: AbortSignal): Promise<GitHubRepoDetail> {
    return this.client.getRepo(owner ?? DEFAULT_OWNER, repo ?? DEFAULT_REPO, signal);
  }

  async listRepoActivity(
    owner?: string,
    repo?: string,
    options?: PaginationOptions,
    signal?: AbortSignal,
  ): Promise<PaginatedResult<GitHubActivity>> {
    const cursor = this.validateCursor(options?.cursor, ACTIVITY_CURSOR_TYPE);
    const limit = options?.limit ?? 20;

    const result = await this.client.listRepoActivity(
      owner ?? DEFAULT_OWNER,
      repo ?? DEFAULT_REPO,
      limit,
      cursor.value || undefined,
      signal,
    );

    const nextCursor = result.nextCursor
      ? encodeCursor({ type: ACTIVITY_CURSOR_TYPE, value: result.nextCursor })
      : undefined;

    return {
      items: result.activities,
      ...(nextCursor ? { nextCursor } : {}),
    };
  }

  async listRepoLanguages(
    owner?: string,
    repo?: string,
    signal?: AbortSignal,
  ): Promise<{ languages: GitHubLanguage[] }> {
    const languagesMap = await this.client.listRepoLanguages(owner ?? DEFAULT_OWNER, repo ?? DEFAULT_REPO, signal);
    const languages = Object.entries(languagesMap)
      .map(([name, bytes]) => ({ name, bytes }))
      .toSorted((a, b) => b.bytes - a.bytes);
    return { languages };
  }

  async listRepoTags(
    owner?: string,
    repo?: string,
    signal?: AbortSignal,
  ): Promise<{ tags: GitHubTag[]; count: number }> {
    const tags = await this.client.listRepoTags(owner ?? DEFAULT_OWNER, repo ?? DEFAULT_REPO, 30, signal);
    return { tags, count: tags.length };
  }

  private validateCursor(encodedCursor: string | undefined, expectedType: string): Cursor {
    if (encodedCursor === undefined) {
      return { type: "", value: "" };
    }
    const cursor = decodeCursor(encodedCursor);
    if (cursor === null) {
      throw new InvalidCursorError("invalid cursor format");
    }
    if (cursor.type && cursor.type !== expectedType) {
      throw new InvalidCursorError(`cursor type mismatch: expected ${expectedType}`);
    }
    return cursor;
  }
}
