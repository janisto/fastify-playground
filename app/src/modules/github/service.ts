import { env } from "../../env.js";
import { type Cursor, decodeCursor, encodeCursor } from "../../utils/pagination.js";

import { GitHubClient, type GitHubClientOptions } from "./client.js";
import { InvalidCursorError } from "./errors.js";
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
  private client: GitHubClient;

  constructor(client?: GitHubClient) {
    const options: GitHubClientOptions = {};
    if (env.GITHUB_TOKEN) {
      options.token = env.GITHUB_TOKEN;
    }
    this.client = client ?? new GitHubClient(options);
  }

  async getOwner(owner?: string): Promise<GitHubOwner> {
    return this.client.getOwner(owner ?? DEFAULT_OWNER);
  }

  async listOwnerRepos(owner?: string): Promise<{ repos: GitHubRepo[]; count: number }> {
    const repos = await this.client.listOwnerRepos(owner ?? DEFAULT_OWNER);
    return { repos, count: repos.length };
  }

  async getRepo(owner?: string, repo?: string): Promise<GitHubRepoDetail> {
    return this.client.getRepo(owner ?? DEFAULT_OWNER, repo ?? DEFAULT_REPO);
  }

  async listRepoActivity(
    owner?: string,
    repo?: string,
    options?: PaginationOptions,
  ): Promise<PaginatedResult<GitHubActivity>> {
    const cursor = this.validateCursor(options?.cursor, ACTIVITY_CURSOR_TYPE);
    const limit = options?.limit ?? 20;

    const result = await this.client.listRepoActivity(
      owner ?? DEFAULT_OWNER,
      repo ?? DEFAULT_REPO,
      limit,
      cursor.value || undefined,
    );

    return {
      items: result.activities,
      nextCursor: result.nextCursor
        ? encodeCursor({ type: ACTIVITY_CURSOR_TYPE, value: result.nextCursor })
        : undefined,
    };
  }

  async listRepoLanguages(owner?: string, repo?: string): Promise<{ languages: GitHubLanguage[] }> {
    const languagesMap = await this.client.listRepoLanguages(owner ?? DEFAULT_OWNER, repo ?? DEFAULT_REPO);
    const languages = Object.entries(languagesMap)
      .map(([name, bytes]) => ({ name, bytes }))
      .toSorted((a, b) => b.bytes - a.bytes);
    return { languages };
  }

  async listRepoTags(owner?: string, repo?: string): Promise<{ tags: GitHubTag[]; count: number }> {
    const tags = await this.client.listRepoTags(owner ?? DEFAULT_OWNER, repo ?? DEFAULT_REPO);
    return { tags, count: tags.length };
  }

  private validateCursor(encodedCursor: string | undefined, expectedType: string): Cursor {
    if (!encodedCursor) {
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
