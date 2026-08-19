import { decodeCursor, encodeCursor, InvalidCursorError } from "../../utils/pagination.js";

import { type ActivityCursor, GitHubClient, scalarCompare } from "./client.js";
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
const ACTIVITY_OPERATION = "listGitHubRepositoryActivity";
const OWNER_REPOS_OPERATION = "listGitHubOwnerRepositories";
const REPO_TAGS_OPERATION = "listGitHubRepositoryTags";

export interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  prevCursor?: string | null;
}

interface DecodedActivityCursor {
  readonly page: number;
  readonly upstream: ActivityCursor;
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
    const page = this.validatePageCursor(options?.cursor, OWNER_REPOS_OPERATION, resolvedOwner, limit);
    const result = await this.client.listOwnerRepos(resolvedOwner, limit, page, signal);
    return {
      items: result.items,
      ...(result.nextPage
        ? { nextCursor: this.encodePageCursor(OWNER_REPOS_OPERATION, "next", resolvedOwner, limit, result.nextPage) }
        : {}),
      ...(result.prevPage === 1
        ? { prevCursor: null }
        : result.prevPage
          ? { prevCursor: this.encodePageCursor(OWNER_REPOS_OPERATION, "prev", resolvedOwner, limit, result.prevPage) }
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
    const currentPage = cursor?.page ?? 1;

    const result = await this.client.listRepoActivity(resolvedOwner, resolvedRepo, limit, cursor?.upstream, signal);

    const nextCursor = result.nextCursor
      ? this.encodeActivityCursor("next", scope, limit, currentPage + 1, result.nextCursor)
      : undefined;
    const prevCursor = result.prevCursor
      ? currentPage <= 2
        ? null
        : this.encodeActivityCursor("prev", scope, limit, currentPage - 1, result.prevCursor)
      : undefined;

    return {
      items: result.activities,
      ...(nextCursor ? { nextCursor } : {}),
      ...(prevCursor !== undefined ? { prevCursor } : {}),
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
      .toSorted((a, b) => b.bytes - a.bytes || scalarCompare(a.name, b.name));
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
    const page = this.validatePageCursor(options?.cursor, REPO_TAGS_OPERATION, scope, limit);
    const result = await this.client.listRepoTags(resolvedOwner, resolvedRepo, limit, page, signal);
    return {
      items: result.items,
      ...(result.nextPage
        ? { nextCursor: this.encodePageCursor(REPO_TAGS_OPERATION, "next", scope, limit, result.nextPage) }
        : {}),
      ...(result.prevPage === 1
        ? { prevCursor: null }
        : result.prevPage
          ? { prevCursor: this.encodePageCursor(REPO_TAGS_OPERATION, "prev", scope, limit, result.prevPage) }
          : {}),
    };
  }

  private validateActivityCursor(
    encodedCursor: string | undefined,
    expectedScope: string,
    expectedLimit: number,
  ): DecodedActivityCursor | undefined {
    if (encodedCursor === undefined) return undefined;

    const cursor = decodeCursor(encodedCursor);
    if (cursor === null) {
      throw new InvalidCursorError("invalid cursor format");
    }
    if (cursor.type !== ACTIVITY_OPERATION) throw new InvalidCursorError("cursor type mismatch");

    const [direction, limitValue, scopeValue, pageValue, upstreamValue, ...extra] = cursor.value.split(":");
    const limit = Number(limitValue);
    const page = Number(pageValue);
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
      (direction !== "next" && direction !== "prev") ||
      !upstreamCursor ||
      !Number.isSafeInteger(limit) ||
      limit !== expectedLimit ||
      !/^[1-9][0-9]*$/.test(pageValue ?? "") ||
      !Number.isSafeInteger(page) ||
      page < 2 ||
      scope !== expectedScope
    ) {
      throw new InvalidCursorError("cursor does not match the requested collection or limit");
    }

    return {
      page,
      upstream: { direction: direction === "next" ? "after" : "before", value: upstreamCursor },
    };
  }

  private encodeActivityCursor(
    direction: "next" | "prev",
    scope: string,
    limit: number,
    page: number,
    value: string,
  ): string {
    return encodeCursor({
      type: ACTIVITY_OPERATION,
      value: `${direction}:${limit}:${encodeURIComponent(scope)}:${page}:${encodeURIComponent(value)}`,
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

    const [direction, limitValue, scopeValue, pageValue, ...extra] = cursor.value.split(":");
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
      (direction !== "next" && direction !== "prev") ||
      !Number.isSafeInteger(limit) ||
      limit !== expectedLimit ||
      scope !== expectedScope ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      (direction === "next" && page === 1)
    ) {
      throw new InvalidCursorError("cursor does not match the requested collection or limit");
    }
    return page;
  }

  private encodePageCursor(
    type: string,
    direction: "next" | "prev",
    scope: string,
    limit: number,
    page: number,
  ): string {
    return encodeCursor({
      type,
      value: `${direction}:${limit}:${encodeURIComponent(scope)}:${page}`,
    });
  }
}
