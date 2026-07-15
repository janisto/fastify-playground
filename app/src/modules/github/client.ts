import { type Dispatcher, request as undiciRequest } from "undici";

import {
  GITHUB_ERROR_FORBIDDEN,
  GITHUB_ERROR_NOT_FOUND,
  GITHUB_ERROR_RATE_LIMIT,
  GITHUB_ERROR_UPSTREAM,
  GitHubApiError,
} from "./errors.js";
import type { GitHubActivity, GitHubOwner, GitHubRepo, GitHubRepoDetail, GitHubTag } from "./schemas.js";

export interface GitHubClientOptions {
  baseUrl?: string;
  token?: string;
  dispatcher?: Dispatcher;
}

type ResponseHeaders = Record<string, string | string[] | undefined>;

interface RawGitHubOwner {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

interface RawGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  visibility: string;
  fork: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  default_branch?: string;
  license?: { spdx_id: string } | null;
  topics?: string[];
  disabled?: boolean;
}

interface RawGitHubActivity {
  id: number;
  actor: { login: string; avatar_url: string };
  ref: string;
  timestamp: string;
  activity_type: string;
}

interface RawGitHubTag {
  name: string;
  commit: { sha: string; url: string };
}

export interface ActivityPage {
  activities: GitHubActivity[];
  nextCursor: string | null;
}

export class GitHubClient {
  private readonly baseUrl: string;
  private readonly dispatcher: Dispatcher | undefined;
  private readonly token: string | undefined;

  constructor(options?: GitHubClientOptions) {
    this.baseUrl = options?.baseUrl ?? "https://api.github.com";
    this.dispatcher = options?.dispatcher;
    this.token = options?.token;
  }

  async getOwner(owner: string): Promise<GitHubOwner> {
    const url = `${this.baseUrl}/users/${encodeURIComponent(owner)}`;
    const { statusCode, headers, body } = await this.request(url);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body));
    }

    const data = (await body.json()) as RawGitHubOwner;
    return this.toGitHubOwner(data);
  }

  async listOwnerRepos(owner: string, perPage = 30): Promise<GitHubRepo[]> {
    const url = `${this.baseUrl}/users/${encodeURIComponent(owner)}/repos?per_page=${perPage}`;
    const { statusCode, headers, body } = await this.request(url);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body));
    }

    const data = (await body.json()) as RawGitHubRepo[];
    return data.map((r) => this.toGitHubRepo(r));
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepoDetail> {
    const url = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const { statusCode, headers, body } = await this.request(url);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body));
    }

    const data = (await body.json()) as RawGitHubRepo;
    return this.toGitHubRepoDetail(data);
  }

  async listRepoActivity(owner: string, repo: string, limit = 20, afterCursor?: string): Promise<ActivityPage> {
    let url = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/activity?per_page=${limit}`;
    if (afterCursor) {
      url += `&after=${encodeURIComponent(afterCursor)}`;
    }

    const { statusCode, headers, body } = await this.request(url);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body));
    }

    const data = (await body.json()) as RawGitHubActivity[];
    const linkHeader = headers["link"] as string | undefined;
    const nextCursor = this.parseLinkHeader(linkHeader ?? null);

    return {
      activities: data.map((a) => this.toGitHubActivity(a)),
      nextCursor,
    };
  }

  async listRepoLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    const url = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`;
    const { statusCode, headers, body } = await this.request(url);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body));
    }

    return (await body.json()) as Record<string, number>;
  }

  async listRepoTags(owner: string, repo: string, perPage = 30): Promise<GitHubTag[]> {
    const url = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags?per_page=${perPage}`;
    const { statusCode, headers, body } = await this.request(url);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body));
    }

    const data = (await body.json()) as RawGitHubTag[];
    return data.map((t) => ({ name: t.name, commit: { sha: t.commit.sha } }));
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "fastify-playground",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private buildRequestOptions() {
    return {
      method: "GET" as const,
      headers: this.buildHeaders(),
      ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
    };
  }

  private async request(url: string): Promise<Dispatcher.ResponseData> {
    try {
      return await undiciRequest(url, this.buildRequestOptions());
    } catch (error) {
      throw new GitHubApiError("GitHub API request failed", 502, GITHUB_ERROR_UPSTREAM, undefined, {
        cause: error,
      });
    }
  }

  private async readErrorMessage(body: Dispatcher.ResponseData["body"]): Promise<string | undefined> {
    try {
      const errorBody = await body.json();
      if (
        typeof errorBody === "object" &&
        errorBody !== null &&
        "message" in errorBody &&
        typeof errorBody.message === "string"
      ) {
        return errorBody.message;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private mapError(statusCode: number, headers: ResponseHeaders, message?: string): GitHubApiError {
    const retryAfter = headers["retry-after"] as string | undefined;
    const rateLimitRemaining = headers["x-ratelimit-remaining"] as string | undefined;

    if (statusCode === 429 || (statusCode === 403 && rateLimitRemaining === "0")) {
      return new GitHubApiError(
        message ?? "GitHub API rate limit exceeded",
        statusCode,
        GITHUB_ERROR_RATE_LIMIT,
        retryAfter,
      );
    }

    if (statusCode === 404) {
      return new GitHubApiError(message ?? "Not found", 404, GITHUB_ERROR_NOT_FOUND);
    }

    if (statusCode === 403) {
      return new GitHubApiError(message ?? "Forbidden", 403, GITHUB_ERROR_FORBIDDEN);
    }

    return new GitHubApiError(message ?? "Upstream GitHub API error", statusCode, GITHUB_ERROR_UPSTREAM);
  }

  private parseLinkHeader(header: string | null): string | null {
    if (!header) return null;

    for (const part of header.split(",")) {
      const trimmed = part.trim();
      if (!trimmed.includes('rel="next"')) continue;

      const start = trimmed.indexOf("<");
      const end = trimmed.indexOf(">");
      if (start < 0 || end < 0 || end <= start) continue;

      try {
        const linkUrl = new URL(trimmed.slice(start + 1, end));
        const after = linkUrl.searchParams.get("after");
        if (after) return after;
      } catch {}
    }
    return null;
  }

  private toGitHubOwner(raw: RawGitHubOwner): GitHubOwner {
    return {
      login: raw.login,
      id: raw.id,
      avatarUrl: raw.avatar_url,
      htmlUrl: raw.html_url,
      type: raw.type,
      name: raw.name,
      company: raw.company,
      blog: raw.blog,
      location: raw.location,
      bio: raw.bio,
      publicRepos: raw.public_repos,
      followers: raw.followers,
      following: raw.following,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }

  private toGitHubRepo(raw: RawGitHubRepo): GitHubRepo {
    return {
      id: raw.id,
      name: raw.name,
      fullName: raw.full_name,
      description: raw.description,
      htmlUrl: raw.html_url,
      language: raw.language,
      stargazersCount: raw.stargazers_count,
      forksCount: raw.forks_count,
      openIssuesCount: raw.open_issues_count,
      visibility: raw.visibility,
      fork: raw.fork,
      archived: raw.archived,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      pushedAt: raw.pushed_at,
    };
  }

  private toGitHubRepoDetail(raw: RawGitHubRepo): GitHubRepoDetail {
    return {
      ...this.toGitHubRepo(raw),
      defaultBranch: raw.default_branch ?? "main",
      license: raw.license?.spdx_id ?? null,
      topics: raw.topics ?? [],
      disabled: raw.disabled ?? false,
    };
  }

  private toGitHubActivity(raw: RawGitHubActivity): GitHubActivity {
    return {
      id: raw.id,
      actor: raw.actor.login,
      ref: raw.ref,
      timestamp: raw.timestamp,
      activityType: raw.activity_type,
      actorAvatarUrl: raw.actor.avatar_url,
    };
  }
}
