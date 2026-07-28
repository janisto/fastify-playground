import { decodeCursor, encodeCursor, InvalidCursorError } from "../../utils/pagination.js";

import { type ActivityCursor, GitHubClient } from "./client.js";
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
const ACTIVITY_AFTER_CURSOR_TYPE = "gh-activity-after";
const ACTIVITY_BEFORE_CURSOR_TYPE = "gh-activity-before";
const OWNER_REPOS_CURSOR_TYPE = "gh-owner-repos";
const REPO_TAGS_CURSOR_TYPE = "gh-repo-tags";

export interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  prevCursor?: string | null;
}

export class GitHubService {
  private readonly client: GitHubClient;

  constructor(client = new GitHubClient()) {
    this.client = client;
  }

  async getOwner(owner?: string, signal?: AbortSignal): Promise<GitHubOwner> {
    return this.client.getOwner(owner ?? DEFAULT_OWNER, signal);
  }

  async listOwnerRepos(
    owner?: string,
    options?: PaginationOptions,
    signal?: AbortSignal,
  ): Promise<PaginatedResult<GitHubRepo>> {
    const resolvedOwner = owner ?? DEFAULT_OWNER;
    const limit = options?.limit ?? 20;
    const page = this.validatePageCursor(options?.cursor, OWNER_REPOS_CURSOR_TYPE, resolvedOwner, limit);
    const result = await this.client.listOwnerRepos(resolvedOwner, limit, page, signal);
    return {
      items: result.items,
      ...(result.nextPage
        ? { nextCursor: this.encodePageCursor(OWNER_REPOS_CURSOR_TYPE, resolvedOwner, limit, result.nextPage) }
        : {}),
      ...(result.prevPage === 1
        ? { prevCursor: null }
        : result.prevPage
          ? { prevCursor: this.encodePageCursor(OWNER_REPOS_CURSOR_TYPE, resolvedOwner, limit, result.prevPage) }
          : {}),
    };
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
    const limit = options?.limit ?? 20;
    const resolvedOwner = owner ?? DEFAULT_OWNER;
    const resolvedRepo = repo ?? DEFAULT_REPO;
    const scope = `${resolvedOwner}/${resolvedRepo}`;
    const cursor = this.validateActivityCursor(options?.cursor, scope, limit);

    const result = await this.client.listRepoActivity(resolvedOwner, resolvedRepo, limit, cursor, signal);

    const nextCursor = result.nextCursor
      ? this.encodeActivityCursor(ACTIVITY_AFTER_CURSOR_TYPE, scope, limit, result.nextCursor)
      : undefined;
    const prevCursor = result.prevCursor
      ? this.encodeActivityCursor(ACTIVITY_BEFORE_CURSOR_TYPE, scope, limit, result.prevCursor)
      : undefined;

    return {
      items: result.activities,
      ...(nextCursor ? { nextCursor } : {}),
      ...(prevCursor ? { prevCursor } : {}),
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
    options?: PaginationOptions,
    signal?: AbortSignal,
  ): Promise<PaginatedResult<GitHubTag>> {
    const resolvedOwner = owner ?? DEFAULT_OWNER;
    const resolvedRepo = repo ?? DEFAULT_REPO;
    const limit = options?.limit ?? 20;
    const scope = `${resolvedOwner}/${resolvedRepo}`;
    const page = this.validatePageCursor(options?.cursor, REPO_TAGS_CURSOR_TYPE, scope, limit);
    const result = await this.client.listRepoTags(resolvedOwner, resolvedRepo, limit, page, signal);
    return {
      items: result.items,
      ...(result.nextPage
        ? { nextCursor: this.encodePageCursor(REPO_TAGS_CURSOR_TYPE, scope, limit, result.nextPage) }
        : {}),
      ...(result.prevPage === 1
        ? { prevCursor: null }
        : result.prevPage
          ? { prevCursor: this.encodePageCursor(REPO_TAGS_CURSOR_TYPE, scope, limit, result.prevPage) }
          : {}),
    };
  }

  private validateActivityCursor(
    encodedCursor: string | undefined,
    expectedScope: string,
    expectedLimit: number,
  ): ActivityCursor | undefined {
    if (encodedCursor === undefined) return undefined;

    const cursor = decodeCursor(encodedCursor);
    if (cursor === null) {
      throw new InvalidCursorError("invalid cursor format");
    }
    if (cursor.type !== ACTIVITY_AFTER_CURSOR_TYPE && cursor.type !== ACTIVITY_BEFORE_CURSOR_TYPE) {
      throw new InvalidCursorError("cursor type mismatch: expected a GitHub activity cursor");
    }

    const [limitValue, scopeValue, upstreamValue, ...extra] = cursor.value.split(":");
    const limit = Number(limitValue);
    let scope: string;
    let upstreamCursor: string;
    try {
      scope = decodeURIComponent(scopeValue ?? "");
      upstreamCursor = decodeURIComponent(upstreamValue ?? "");
    } catch {
      throw new InvalidCursorError("invalid cursor format");
    }
    if (
      extra.length > 0 ||
      !upstreamCursor ||
      !Number.isSafeInteger(limit) ||
      limit !== expectedLimit ||
      scope !== expectedScope
    ) {
      throw new InvalidCursorError("cursor does not match the requested collection or limit");
    }

    if (cursor.type === ACTIVITY_AFTER_CURSOR_TYPE) return { direction: "after", value: upstreamCursor };
    return { direction: "before", value: upstreamCursor };
  }

  private encodeActivityCursor(type: string, scope: string, limit: number, value: string): string {
    return encodeCursor({
      type,
      value: `${limit}:${encodeURIComponent(scope)}:${encodeURIComponent(value)}`,
    });
  }

  private validatePageCursor(
    encodedCursor: string | undefined,
    expectedType: string,
    expectedScope: string,
    expectedLimit: number,
  ): number {
    if (encodedCursor === undefined) return 1;

    const cursor = decodeCursor(encodedCursor);
    if (cursor === null) {
      throw new InvalidCursorError("invalid cursor format");
    }
    if (cursor.type !== expectedType) {
      throw new InvalidCursorError("cursor type mismatch");
    }

    const [limitValue, scopeValue, pageValue, ...extra] = cursor.value.split(":");
    const limit = Number(limitValue);
    const page = Number(pageValue);
    let scope: string;
    try {
      scope = decodeURIComponent(scopeValue ?? "");
    } catch {
      throw new InvalidCursorError("invalid cursor format");
    }
    if (
      extra.length > 0 ||
      !Number.isSafeInteger(limit) ||
      limit !== expectedLimit ||
      scope !== expectedScope ||
      !Number.isSafeInteger(page) ||
      page < 1
    ) {
      throw new InvalidCursorError("cursor does not match the requested collection or limit");
    }
    return page;
  }

  private encodePageCursor(type: string, scope: string, limit: number, page: number): string {
    return encodeCursor({
      type,
      value: `${limit}:${encodeURIComponent(scope)}:${page}`,
    });
  }
}
