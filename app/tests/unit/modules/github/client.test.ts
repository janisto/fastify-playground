import { Buffer } from "node:buffer";
import { Dispatcher, errors, MockAgent } from "undici";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GitHubClient } from "../../../../src/modules/github/client.js";
import {
  GITHUB_ERROR_NOT_FOUND,
  GITHUB_ERROR_RATE_LIMIT,
  GITHUB_ERROR_TIMEOUT,
  GITHUB_ERROR_UPSTREAM,
} from "../../../../src/modules/github/errors.js";

const OWNER_RESPONSE = {
  login: "octocat",
  id: 1,
  avatar_url: "https://avatars.githubusercontent.com/u/1",
  html_url: "https://github.com/octocat",
  type: "User",
  name: "The Octocat",
  company: null,
  blog: "",
  location: "San Francisco",
  bio: "A cat",
  public_repos: 8,
  followers: 1000,
  following: 0,
  created_at: "2011-01-25T18:44:36Z",
  updated_at: "2024-01-01T00:00:00Z",
} as const;

class PartialBodyTimeoutDispatcher extends Dispatcher {
  responseStarted = false;

  override dispatch(_options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandler): boolean {
    let aborted = false;
    let paused = false;
    let reason: Error | null = null;
    const controller: Dispatcher.DispatchController = {
      get aborted() {
        return aborted;
      },
      get paused() {
        return paused;
      },
      get reason() {
        return reason;
      },
      abort(error) {
        aborted = true;
        reason = error;
      },
      pause() {
        paused = true;
      },
      resume() {
        paused = false;
      },
    };

    handler.onRequestStart?.(controller, null);
    handler.onResponseStart?.(controller, 200, { "content-type": "application/json" }, "OK");
    handler.onResponseData?.(controller, Buffer.from('{"login":'));
    this.responseStarted = true;
    queueMicrotask(() => handler.onResponseError?.(controller, new errors.BodyTimeoutError()));
    return true;
  }
}

describe("GitHubClient", () => {
  let mockAgent: MockAgent;
  let mockPool: ReturnType<MockAgent["get"]>;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    mockPool = mockAgent.get("https://api.github.com");
  });

  afterEach(async () => {
    await mockAgent.close();
  });

  describe("getOwner", () => {
    it("fetches public owner data with the current API version and no ambient credential", async () => {
      mockPool
        .intercept({
          path: "/users/octocat",
          method: "GET",
          headers: (headers) => {
            expect(headers["x-github-api-version"]).toBe("2026-03-10");
            expect(headers["authorization"]).toBeUndefined();
            return true;
          },
        })
        .reply(200, OWNER_RESPONSE);

      const client = new GitHubClient({ dispatcher: mockAgent });
      const owner = await client.getOwner("octocat");

      expect(owner.login).toBe("octocat");
      expect(owner.avatarUrl).toBe("https://avatars.githubusercontent.com/u/1");
    });

    it("follows a bounded same-origin redirect for a renamed GitHub resource", async () => {
      mockPool
        .intercept({ path: "/users/renamed-octocat", method: "GET" })
        .reply(301, "", { headers: { location: "/users/octocat" } });
      mockPool.intercept({ path: "/users/octocat", method: "GET" }).reply(200, OWNER_RESPONSE);

      const owner = await new GitHubClient({ dispatcher: mockAgent }).getOwner("renamed-octocat");

      expect(owner.login).toBe("octocat");
      expect(mockAgent.assertNoPendingInterceptors()).toBeUndefined();
    });

    it("rejects a cross-origin redirect before forwarding a credential", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(302, "", { headers: { location: "https://attacker.invalid/users/octocat" } });

      const client = new GitHubClient({ token: "private-token-canary", dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "GitHub API returned an invalid response",
        code: GITHUB_ERROR_UPSTREAM,
        statusCode: 502,
      });
    });

    it("rejects a same-origin redirect loop", async () => {
      mockPool
        .intercept({ path: "/users/loop-a", method: "GET" })
        .reply(302, "", { headers: { location: "/users/loop-b" } });
      mockPool
        .intercept({ path: "/users/loop-b", method: "GET" })
        .reply(302, "", { headers: { location: "/users/loop-a" } });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("loop-a")).rejects.toMatchObject({
        message: "GitHub API returned an invalid response",
        code: GITHUB_ERROR_UPSTREAM,
        statusCode: 502,
      });
    });

    it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects an invalid timeout %s", (timeoutMs) => {
      expect(() => new GitHubClient({ timeoutMs })).toThrow(RangeError);
    });

    it("throws GitHubApiError on 404", async () => {
      mockPool.intercept({ path: "/users/nonexistent", method: "GET" }).reply(404, { message: "Not Found" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("nonexistent")).rejects.toMatchObject({
        name: "GitHubApiError",
        code: GITHUB_ERROR_NOT_FOUND,
        statusCode: 404,
      });
    });

    it("detects rate limit from 429", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(429, { message: "Rate limited" }, { headers: { "Retry-After": "60" } });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        code: GITHUB_ERROR_RATE_LIMIT,
        retryAfter: "60",
      });
    });

    it("includes authorization header when token provided", async () => {
      mockPool
        .intercept({
          path: "/users/octocat",
          method: "GET",
          headers: { Authorization: "Bearer test-token" },
        })
        .reply(200, {
          login: "octocat",
          id: 1,
          avatar_url: "https://avatars.githubusercontent.com/u/1",
          html_url: "https://github.com/octocat",
          type: "User",
          name: null,
          company: null,
          blog: null,
          location: null,
          bio: null,
          public_repos: 0,
          followers: 0,
          following: 0,
          created_at: "2011-01-25T18:44:36Z",
          updated_at: "2024-01-01T00:00:00Z",
        });

      const client = new GitHubClient({ token: "test-token", dispatcher: mockAgent });
      await client.getOwner("octocat");
    });
  });

  describe("listOwnerRepos", () => {
    it("fetches repositories successfully", async () => {
      mockPool.intercept({ path: /\/users\/octocat\/repos/, method: "GET" }).reply(200, [
        {
          id: 1,
          name: "Hello-World",
          full_name: "octocat/Hello-World",
          description: "My first repository",
          html_url: "https://github.com/octocat/Hello-World",
          language: "JavaScript",
          stargazers_count: 100,
          forks_count: 50,
          open_issues_count: 5,
          visibility: "public",
          fork: false,
          archived: false,
          created_at: "2011-01-25T18:44:36Z",
          updated_at: "2024-01-01T00:00:00Z",
          pushed_at: "2024-01-01T00:00:00Z",
        },
      ]);

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listOwnerRepos("octocat");

      expect(result.items).toHaveLength(1);
      expect(result.items.at(0)?.name).toBe("Hello-World");
      expect(result.items.at(0)?.fullName).toBe("octocat/Hello-World");
    });

    it("returns GitHub's next and previous page boundaries", async () => {
      mockPool.intercept({ path: /\/users\/octocat\/repos/, method: "GET" }).reply(200, [], {
        headers: {
          link: [
            '<https://api.github.com/users/octocat/repos?per_page=5&page=3>; rel="next"',
            '<https://api.github.com/users/octocat/repos?per_page=5&page=1>; rel="prev"',
          ].join(", "),
        },
      });

      const result = await new GitHubClient({ dispatcher: mockAgent }).listOwnerRepos("octocat", 5, 2);

      expect(result).toEqual({ items: [], nextPage: 3, prevPage: 1 });
    });

    it("throws error when user not found", async () => {
      mockPool.intercept({ path: /\/users\/nonexistent\/repos/, method: "GET" }).reply(404, { message: "Not Found" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.listOwnerRepos("nonexistent")).rejects.toMatchObject({
        name: "GitHubApiError",
        code: GITHUB_ERROR_NOT_FOUND,
      });
    });

    it("preserves nullable timestamps from GitHub instead of fabricating dates", async () => {
      mockPool.intercept({ path: /\/users\/octocat\/repos/, method: "GET" }).reply(200, [
        {
          id: 1,
          name: "empty",
          full_name: "octocat/empty",
          description: null,
          html_url: "https://github.com/octocat/empty",
          language: null,
          stargazers_count: 0,
          forks_count: 0,
          open_issues_count: 0,
          visibility: "public",
          fork: false,
          archived: false,
          created_at: null,
          updated_at: null,
          pushed_at: null,
        },
      ]);

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listOwnerRepos("octocat");

      expect(result.items.at(0)).toMatchObject({ createdAt: null, updatedAt: null, pushedAt: null });
    });
  });

  describe("getRepo", () => {
    it("fetches repository details successfully", async () => {
      mockPool.intercept({ path: "/repos/octocat/Hello-World", method: "GET" }).reply(200, {
        id: 1,
        name: "Hello-World",
        full_name: "octocat/Hello-World",
        description: "My first repository",
        html_url: "https://github.com/octocat/Hello-World",
        language: "JavaScript",
        stargazers_count: 100,
        forks_count: 50,
        open_issues_count: 5,
        visibility: "public",
        fork: false,
        archived: false,
        created_at: "2011-01-25T18:44:36Z",
        updated_at: "2024-01-01T00:00:00Z",
        pushed_at: "2024-01-01T00:00:00Z",
        default_branch: "main",
        license: { spdx_id: "MIT" },
        topics: ["javascript", "nodejs"],
        disabled: false,
      });

      const client = new GitHubClient({ dispatcher: mockAgent });
      const repo = await client.getRepo("octocat", "Hello-World");

      expect(repo.name).toBe("Hello-World");
      expect(repo.defaultBranch).toBe("main");
      expect(repo.license).toBe("MIT");
      expect(repo.topics).toEqual(["javascript", "nodejs"]);
    });

    it("throws error when repo not found", async () => {
      mockPool.intercept({ path: "/repos/octocat/nonexistent", method: "GET" }).reply(404, { message: "Not Found" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getRepo("octocat", "nonexistent")).rejects.toMatchObject({
        name: "GitHubApiError",
        code: GITHUB_ERROR_NOT_FOUND,
      });
    });

    it("preserves required upstream values while defaulting only an omitted topics array", async () => {
      mockPool.intercept({ path: "/repos/octocat/minimal", method: "GET" }).reply(200, {
        id: 1,
        name: "minimal",
        full_name: "octocat/minimal",
        description: null,
        html_url: "https://github.com/octocat/minimal",
        language: null,
        stargazers_count: 0,
        forks_count: 0,
        open_issues_count: 0,
        visibility: "public",
        fork: false,
        archived: false,
        created_at: "2011-01-25T18:44:36Z",
        updated_at: "2024-01-01T00:00:00Z",
        pushed_at: "2024-01-01T00:00:00Z",
        default_branch: "trunk",
        license: null,
        disabled: false,
        // GitHub may omit topics when the representation does not include them.
      });

      const client = new GitHubClient({ dispatcher: mockAgent });
      const repo = await client.getRepo("octocat", "minimal");

      expect(repo.defaultBranch).toBe("trunk");
      expect(repo.license).toBeNull();
      expect(repo.topics).toEqual([]);
      expect(repo.disabled).toBe(false);
    });
  });

  describe("listRepoActivity", () => {
    it("parses both directions from a pagination Link header", async () => {
      mockPool.intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" }).reply(
        200,
        [
          {
            id: 1,
            actor: { login: "user", avatar_url: "https://avatars.githubusercontent.com/u/1" },
            ref: "refs/heads/main",
            timestamp: "2024-01-01T00:00:00Z",
            activity_type: "push",
          },
        ],
        {
          headers: {
            Link: '<https://api.github.com/repos/octocat/repo/activity?after=cursor123>; rel="next", <https://api.github.com/repos/octocat/repo/activity?before=cursor456>; rel="prev"',
          },
        },
      );

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listRepoActivity("octocat", "repo");

      expect(result.nextCursor).toBe("cursor123");
      expect(result.prevCursor).toBe("cursor456");
      expect(result.activities).toHaveLength(1);
    });

    it("returns null cursor when no Link header", async () => {
      mockPool.intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" }).reply(200, []);

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listRepoActivity("octocat", "repo");

      expect(result.nextCursor).toBeNull();
    });

    it("maps a deleted activity actor to explicit null fields", async () => {
      mockPool.intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" }).reply(200, [
        {
          id: 1,
          actor: null,
          ref: "refs/heads/main",
          timestamp: "2024-01-01T00:00:00Z",
          activity_type: "push",
        },
      ]);

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listRepoActivity("octocat", "repo");

      expect(result.activities).toEqual([
        {
          id: 1,
          actor: null,
          actorAvatarUrl: null,
          ref: "refs/heads/main",
          timestamp: "2024-01-01T00:00:00Z",
          activityType: "push",
        },
      ]);
    });

    it("throws error when repo not found", async () => {
      mockPool
        .intercept({ path: /\/repos\/octocat\/nonexistent\/activity/, method: "GET" })
        .reply(404, { message: "Not Found" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.listRepoActivity("octocat", "nonexistent")).rejects.toMatchObject({
        name: "GitHubApiError",
        code: GITHUB_ERROR_NOT_FOUND,
      });
    });

    it("uses the after parameter for a forward cursor", async () => {
      mockPool
        .intercept({
          path: /\/repos\/octocat\/repo\/activity\?.*per_page=20.*after=abc123|\/repos\/octocat\/repo\/activity\?.*after=abc123.*per_page=20/,
          method: "GET",
        })
        .reply(200, []);

      const client = new GitHubClient({ dispatcher: mockAgent });
      await client.listRepoActivity("octocat", "repo", 20, { direction: "after", value: "abc123" });
    });

    it("uses the before parameter for a backward cursor", async () => {
      mockPool
        .intercept({
          path: /\/repos\/octocat\/repo\/activity\?.*per_page=20.*before=abc123|\/repos\/octocat\/repo\/activity\?.*before=abc123.*per_page=20/,
          method: "GET",
        })
        .reply(200, []);

      const client = new GitHubClient({ dispatcher: mockAgent });
      await client.listRepoActivity("octocat", "repo", 20, { direction: "before", value: "abc123" });
    });

    it("returns null cursor when Link header has malformed URL", async () => {
      mockPool.intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" }).reply(200, [], {
        headers: {
          Link: '<not-a-valid-url>; rel="next"',
        },
      });

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listRepoActivity("octocat", "repo");

      expect(result.nextCursor).toBeNull();
    });

    it("returns null cursor when Link header has no after param", async () => {
      mockPool.intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" }).reply(200, [], {
        headers: {
          Link: '<https://api.github.com/repos/octocat/repo/activity?page=2>; rel="next"',
        },
      });

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listRepoActivity("octocat", "repo");

      expect(result.nextCursor).toBeNull();
    });

    it("finds next cursor in multi-part Link header", async () => {
      mockPool.intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" }).reply(200, [], {
        headers: {
          Link: '<https://api.github.com/repos/octocat/repo/activity?page=1>; rel="prev", <https://api.github.com/repos/octocat/repo/activity?after=xyz789>; rel="next"',
        },
      });

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listRepoActivity("octocat", "repo");

      expect(result.nextCursor).toBe("xyz789");
    });

    it("handles Link header with malformed angle brackets", async () => {
      mockPool.intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" }).reply(200, [], {
        headers: {
          Link: 'malformed-no-brackets; rel="next"',
        },
      });

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listRepoActivity("octocat", "repo");

      expect(result.nextCursor).toBeNull();
    });
  });

  describe("listRepoLanguages", () => {
    it("fetches languages successfully", async () => {
      mockPool.intercept({ path: "/repos/octocat/Hello-World/languages", method: "GET" }).reply(200, {
        TypeScript: 78769,
        JavaScript: 1234,
      });

      const client = new GitHubClient({ dispatcher: mockAgent });
      const languages = await client.listRepoLanguages("octocat", "Hello-World");

      expect(languages).toEqual({ TypeScript: 78769, JavaScript: 1234 });
    });

    it("throws error when repo not found", async () => {
      mockPool
        .intercept({ path: "/repos/octocat/nonexistent/languages", method: "GET" })
        .reply(404, { message: "Not Found" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.listRepoLanguages("octocat", "nonexistent")).rejects.toMatchObject({
        name: "GitHubApiError",
        code: GITHUB_ERROR_NOT_FOUND,
      });
    });
  });

  describe("listRepoTags", () => {
    it("fetches tags successfully", async () => {
      mockPool.intercept({ path: /\/repos\/octocat\/Hello-World\/tags/, method: "GET" }).reply(200, [
        { name: "v1.0.0", commit: { sha: "abc123", url: "https://api.github.com/..." } },
        { name: "v0.9.0", commit: { sha: "def456", url: "https://api.github.com/..." } },
      ]);

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listRepoTags("octocat", "Hello-World");

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({ name: "v1.0.0", commit: { sha: "abc123" } });
    });

    it("throws error when repo not found", async () => {
      mockPool
        .intercept({ path: /\/repos\/octocat\/nonexistent\/tags/, method: "GET" })
        .reply(404, { message: "Not Found" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.listRepoTags("octocat", "nonexistent")).rejects.toMatchObject({
        name: "GitHubApiError",
        code: GITHUB_ERROR_NOT_FOUND,
      });
    });
  });

  describe("error handling", () => {
    it("detects rate limit from 403 with x-ratelimit-remaining header", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(403, { message: "Rate limit exceeded" }, { headers: { "x-ratelimit-remaining": "0" } });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        code: GITHUB_ERROR_RATE_LIMIT,
      });
    });

    it("classifies a secondary limit with Retry-After even when primary quota remains", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(
          403,
          { message: "You have exceeded a secondary rate limit." },
          { headers: { "retry-after": "17", "x-ratelimit-remaining": "4999" } },
        );

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        code: GITHUB_ERROR_RATE_LIMIT,
        retryAfter: "17",
      });
    });

    it("uses a bounded fallback delay for a secondary limit without retry headers", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(403, { message: "Secondary rate limit exceeded" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        code: GITHUB_ERROR_RATE_LIMIT,
        retryAfter: "60",
      });
    });

    it("throws forbidden error for 403 without rate limit", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(403, { message: "Resource not accessible by integration" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        code: "github_forbidden",
      });
    });

    it("throws upstream error for 5xx", async () => {
      mockPool.intercept({ path: "/users/octocat", method: "GET" }).reply(502, { message: "Bad Gateway" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        code: "github_upstream",
      });
    });

    it("uses fallback message for 404 when no message provided", async () => {
      mockPool.intercept({ path: "/users/noone", method: "GET" }).reply(404, {});

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("noone")).rejects.toMatchObject({
        message: "Not found",
        code: GITHUB_ERROR_NOT_FOUND,
      });
    });

    it("uses fallback message for 403 when no message provided", async () => {
      mockPool.intercept({ path: "/users/octocat", method: "GET" }).reply(403, {});

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "Forbidden",
        code: "github_forbidden",
      });
    });

    it("uses fallback message for rate limit when no message provided", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(429, {}, { headers: { "Retry-After": "120" } });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "GitHub API rate limit exceeded",
        code: GITHUB_ERROR_RATE_LIMIT,
        retryAfter: "120",
      });
    });

    it("uses fallback message for upstream error when no message provided", async () => {
      mockPool.intercept({ path: "/users/octocat", method: "GET" }).reply(500, {});

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "Upstream GitHub API error",
        code: "github_upstream",
      });
    });

    it("uses a controlled fallback when an error response is not JSON", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(502, "proxy detail canary", { headers: { "content-type": "text/html" } });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "Upstream GitHub API error",
        code: "github_upstream",
      });
    });

    it("maps transport failures to a stable upstream error", async () => {
      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("no-interceptor")).rejects.toMatchObject({
        message: "GitHub API request failed",
        code: "github_upstream",
        statusCode: 502,
        cause: expect.any(Error),
      });
    });

    it("rejects malformed successful JSON without leaking the upstream payload", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(200, "{private-upstream-canary", { headers: { "content-type": "application/json" } });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "GitHub API returned an invalid response",
        code: GITHUB_ERROR_UPSTREAM,
        statusCode: 502,
      });
    });

    it("rejects a successful payload that violates the documented schema", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(200, { ...OWNER_RESPONSE, id: "not-an-integer-canary" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "GitHub API returned an invalid response",
        code: GITHUB_ERROR_UPSTREAM,
        statusCode: 502,
      });
    });

    it("rejects numeric strings instead of coercing malformed upstream data", async () => {
      mockPool
        .intercept({ path: "/users/octocat", method: "GET" })
        .reply(200, { ...OWNER_RESPONSE, id: "1", public_repos: "8" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "GitHub API returned an invalid response",
        code: GITHUB_ERROR_UPSTREAM,
        statusCode: 502,
      });
    });

    it.each([
      ["timestamp", { ...OWNER_RESPONSE, created_at: "not-a-date-time-canary" }],
      ["URL", { ...OWNER_RESPONSE, avatar_url: "not-an-absolute-uri-canary" }],
    ])("rejects a successful payload with an invalid %s format", async (_field, payload) => {
      mockPool.intercept({ path: "/users/octocat", method: "GET" }).reply(200, payload);

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "GitHub API returned an invalid response",
        code: GITHUB_ERROR_UPSTREAM,
        statusCode: 502,
      });
    });

    it("maps an exceeded overall deadline to a stable timeout error", async () => {
      mockPool.intercept({ path: "/users/octocat", method: "GET" }).reply(200, OWNER_RESPONSE).delay(100);

      const client = new GitHubClient({ dispatcher: mockAgent, timeoutMs: 10 });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "GitHub API request timed out",
        code: GITHUB_ERROR_TIMEOUT,
        statusCode: 504,
      });
    });

    it("maps a body timeout after response headers to a stable timeout error", async () => {
      const dispatcher = new PartialBodyTimeoutDispatcher();
      const client = new GitHubClient({ dispatcher });

      await expect(client.getOwner("octocat")).rejects.toMatchObject({
        message: "GitHub API request timed out",
        code: GITHUB_ERROR_TIMEOUT,
        statusCode: 504,
      });
      expect(dispatcher.responseStarted).toBe(true);
    });

    it("propagates caller cancellation instead of disguising it as an upstream failure", async () => {
      mockPool.intercept({ path: "/users/octocat", method: "GET" }).reply(200, OWNER_RESPONSE).delay(100);
      const controller = new AbortController();
      const reason = new Error("request lifecycle cancellation canary");
      const client = new GitHubClient({ dispatcher: mockAgent, timeoutMs: 500 });

      const pending = client.getOwner("octocat", controller.signal);
      controller.abort(reason);

      await expect(pending).rejects.toBe(reason);
    });
  });
});
