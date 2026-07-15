import type { StaticDecode, TSchema } from "typebox";
import Value from "typebox/value";
import { type Dispatcher, request as undiciRequest } from "undici";

import {
  GITHUB_ERROR_FORBIDDEN,
  GITHUB_ERROR_NOT_FOUND,
  GITHUB_ERROR_RATE_LIMIT,
  GITHUB_ERROR_TIMEOUT,
  GITHUB_ERROR_UPSTREAM,
  GitHubApiError,
} from "./errors.js";
import type { GitHubActivity, GitHubOwner, GitHubRepo, GitHubRepoDetail, GitHubTag } from "./schemas.js";
import {
  type RawGitHubActivity,
  RawGitHubActivityListSchema,
  RawGitHubLanguagesSchema,
  type RawGitHubOwner,
  RawGitHubOwnerReposSchema,
  RawGitHubOwnerSchema,
  type RawGitHubRepo,
  type RawGitHubRepoDetail,
  RawGitHubRepoDetailSchema,
  RawGitHubTagsSchema,
} from "./upstream-schemas.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const GITHUB_API_VERSION = "2026-03-10";
const SECONDARY_RATE_LIMIT_PATTERN = /secondary rate limit|abuse detection/i;

export interface GitHubClientOptions {
  baseUrl?: string;
  /** Explicit credential for trusted direct client use, such as opt-in integration tests. */
  token?: string;
  dispatcher?: Dispatcher;
  timeoutMs?: number;
}

type ResponseHeaders = Record<string, string | string[] | undefined>;
type RequestResult = Dispatcher.ResponseData & { timeoutSignal: AbortSignal };

export interface ActivityPage {
  activities: GitHubActivity[];
  nextCursor: string | null;
}

function getHeader(headers: ResponseHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value.at(0) : value;
}

function hasErrorCode(error: unknown, ...codes: string[]): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    codes.includes(error.code)
  );
}

function hasUndiciErrorCode(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("UND_ERR_")
  );
}

export class GitHubClient {
  private readonly baseUrl: string;
  private readonly dispatcher: Dispatcher | undefined;
  private readonly timeoutMs: number;
  private readonly token: string | undefined;

  constructor(options?: GitHubClientOptions) {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError("GitHub request timeout must be a positive safe integer");
    }

    this.baseUrl = options?.baseUrl ?? "https://api.github.com";
    this.dispatcher = options?.dispatcher;
    this.timeoutMs = timeoutMs;
    this.token = options?.token;
  }

  async getOwner(owner: string, signal?: AbortSignal): Promise<GitHubOwner> {
    const url = `${this.baseUrl}/users/${encodeURIComponent(owner)}`;
    const { statusCode, headers, body, timeoutSignal } = await this.request(url, signal);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body, signal, timeoutSignal));
    }

    return this.toGitHubOwner(await this.readValidatedBody(body, RawGitHubOwnerSchema, signal, timeoutSignal));
  }

  async listOwnerRepos(owner: string, perPage = 30, signal?: AbortSignal): Promise<GitHubRepo[]> {
    const url = `${this.baseUrl}/users/${encodeURIComponent(owner)}/repos?per_page=${perPage}`;
    const { statusCode, headers, body, timeoutSignal } = await this.request(url, signal);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body, signal, timeoutSignal));
    }

    const data = await this.readValidatedBody(body, RawGitHubOwnerReposSchema, signal, timeoutSignal);
    return data.map((repo) => this.toGitHubRepo(repo));
  }

  async getRepo(owner: string, repo: string, signal?: AbortSignal): Promise<GitHubRepoDetail> {
    const url = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const { statusCode, headers, body, timeoutSignal } = await this.request(url, signal);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body, signal, timeoutSignal));
    }

    return this.toGitHubRepoDetail(
      await this.readValidatedBody(body, RawGitHubRepoDetailSchema, signal, timeoutSignal),
    );
  }

  async listRepoActivity(
    owner: string,
    repo: string,
    limit = 20,
    afterCursor?: string,
    signal?: AbortSignal,
  ): Promise<ActivityPage> {
    let url = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/activity?per_page=${limit}`;
    if (afterCursor) {
      url += `&after=${encodeURIComponent(afterCursor)}`;
    }

    const { statusCode, headers, body, timeoutSignal } = await this.request(url, signal);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body, signal, timeoutSignal));
    }

    const data = await this.readValidatedBody(body, RawGitHubActivityListSchema, signal, timeoutSignal);
    const nextCursor = this.parseLinkHeader(getHeader(headers, "link") ?? null);

    return {
      activities: data.map((activity) => this.toGitHubActivity(activity)),
      nextCursor,
    };
  }

  async listRepoLanguages(owner: string, repo: string, signal?: AbortSignal): Promise<Record<string, number>> {
    const url = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`;
    const { statusCode, headers, body, timeoutSignal } = await this.request(url, signal);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body, signal, timeoutSignal));
    }

    return this.readValidatedBody(body, RawGitHubLanguagesSchema, signal, timeoutSignal);
  }

  async listRepoTags(owner: string, repo: string, perPage = 30, signal?: AbortSignal): Promise<GitHubTag[]> {
    const url = `${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags?per_page=${perPage}`;
    const { statusCode, headers, body, timeoutSignal } = await this.request(url, signal);

    if (statusCode !== 200) {
      throw this.mapError(statusCode, headers, await this.readErrorMessage(body, signal, timeoutSignal));
    }

    const data = await this.readValidatedBody(body, RawGitHubTagsSchema, signal, timeoutSignal);
    return data.map((tag) => ({ name: tag.name, commit: { sha: tag.commit.sha } }));
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": "fastify-playground",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private buildRequestOptions(signal: AbortSignal) {
    return {
      method: "GET",
      headers: this.buildHeaders(),
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
      signal,
      ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
    };
  }

  private async request(url: string, callerSignal?: AbortSignal): Promise<RequestResult> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;

    try {
      const response = await undiciRequest(url, this.buildRequestOptions(signal));
      return { ...response, timeoutSignal };
    } catch (error) {
      this.throwRequestFailure(error, callerSignal, timeoutSignal);
    }
  }

  private async readValidatedBody<const Schema extends TSchema>(
    body: Dispatcher.ResponseData["body"],
    schema: Schema,
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): Promise<StaticDecode<Schema>> {
    let value: unknown;
    try {
      value = await body.json();
    } catch (error) {
      if (callerSignal?.aborted || timeoutSignal.aborted || hasUndiciErrorCode(error)) {
        this.throwRequestFailure(error, callerSignal, timeoutSignal);
      }
      throw this.invalidResponse("GitHub API returned invalid JSON");
    }

    try {
      return Value.Decode(schema, value);
    } catch {
      throw this.invalidResponse("GitHub API response did not match its documented schema");
    }
  }

  private invalidResponse(reason: string): GitHubApiError {
    return new GitHubApiError("GitHub API returned an invalid response", 502, GITHUB_ERROR_UPSTREAM, undefined, {
      cause: new TypeError(reason),
    });
  }

  private async readErrorMessage(
    body: Dispatcher.ResponseData["body"],
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): Promise<string | undefined> {
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
    } catch (error) {
      if (callerSignal?.aborted || timeoutSignal.aborted || hasUndiciErrorCode(error)) {
        this.throwRequestFailure(error, callerSignal, timeoutSignal);
      }
      return undefined;
    }
    return undefined;
  }

  private throwRequestFailure(
    error: unknown,
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): never {
    if (callerSignal?.aborted) {
      throw callerSignal.reason instanceof Error ? callerSignal.reason : error;
    }
    if (
      timeoutSignal.aborted ||
      hasErrorCode(error, "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_CONNECT_TIMEOUT")
    ) {
      throw new GitHubApiError("GitHub API request timed out", 504, GITHUB_ERROR_TIMEOUT, undefined, {
        cause: error,
      });
    }
    throw new GitHubApiError("GitHub API request failed", 502, GITHUB_ERROR_UPSTREAM, undefined, {
      cause: error,
    });
  }

  private mapError(statusCode: number, headers: ResponseHeaders, message?: string): GitHubApiError {
    const retryAfter = getHeader(headers, "retry-after");
    const rateLimitRemaining = getHeader(headers, "x-ratelimit-remaining");
    const secondaryRateLimit = statusCode === 403 && SECONDARY_RATE_LIMIT_PATTERN.test(message ?? "");
    const rateLimited =
      statusCode === 429 ||
      (statusCode === 403 && (retryAfter !== undefined || rateLimitRemaining === "0" || secondaryRateLimit));

    if (rateLimited) {
      return new GitHubApiError(
        message ?? "GitHub API rate limit exceeded",
        statusCode,
        GITHUB_ERROR_RATE_LIMIT,
        retryAfter ?? this.deriveRetryAfter(headers),
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

  private deriveRetryAfter(headers: ResponseHeaders): string {
    const reset = Number(getHeader(headers, "x-ratelimit-reset"));
    if (Number.isFinite(reset) && reset > 0) {
      return String(Math.max(0, Math.ceil(reset - Date.now() / 1000)));
    }
    return "60";
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

  private toGitHubRepoDetail(raw: RawGitHubRepoDetail): GitHubRepoDetail {
    return {
      ...this.toGitHubRepo(raw),
      defaultBranch: raw.default_branch,
      license: raw.license?.spdx_id ?? null,
      topics: raw.topics ?? [],
      disabled: raw.disabled,
    };
  }

  private toGitHubActivity(raw: RawGitHubActivity): GitHubActivity {
    return {
      id: raw.id,
      actor: raw.actor?.login ?? null,
      ref: raw.ref,
      timestamp: raw.timestamp,
      activityType: raw.activity_type,
      actorAvatarUrl: raw.actor?.avatar_url ?? null,
    };
  }
}
