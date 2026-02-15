import { MockAgent } from "undici";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GitHubClient } from "../../../../src/modules/github/client.js";
import { GITHUB_ERROR_NOT_FOUND, GITHUB_ERROR_RATE_LIMIT } from "../../../../src/modules/github/errors.js";

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
    it("fetches owner successfully", async () => {
      mockPool.intercept({ path: "/users/octocat", method: "GET" }).reply(200, {
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
      });

      const client = new GitHubClient({ dispatcher: mockAgent });
      const owner = await client.getOwner("octocat");

      expect(owner.login).toBe("octocat");
      expect(owner.avatarUrl).toBe("https://avatars.githubusercontent.com/u/1");
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
          avatar_url: "",
          html_url: "",
          type: "User",
          name: null,
          company: null,
          blog: null,
          location: null,
          bio: null,
          public_repos: 0,
          followers: 0,
          following: 0,
          created_at: "",
          updated_at: "",
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
      const repos = await client.listOwnerRepos("octocat");

      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe("Hello-World");
      expect(repos[0].fullName).toBe("octocat/Hello-World");
    });

    it("throws error when user not found", async () => {
      mockPool.intercept({ path: /\/users\/nonexistent\/repos/, method: "GET" }).reply(404, { message: "Not Found" });

      const client = new GitHubClient({ dispatcher: mockAgent });

      await expect(client.listOwnerRepos("nonexistent")).rejects.toMatchObject({
        name: "GitHubApiError",
        code: GITHUB_ERROR_NOT_FOUND,
      });
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

    it("handles repo with missing optional fields", async () => {
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
        // No default_branch, license, topics, disabled
      });

      const client = new GitHubClient({ dispatcher: mockAgent });
      const repo = await client.getRepo("octocat", "minimal");

      expect(repo.defaultBranch).toBe("main"); // default
      expect(repo.license).toBeNull();
      expect(repo.topics).toEqual([]);
      expect(repo.disabled).toBe(false);
    });
  });

  describe("listRepoActivity", () => {
    it("parses Link header for pagination cursor", async () => {
      mockPool.intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" }).reply(
        200,
        [
          {
            id: 1,
            actor: { login: "user", avatar_url: "" },
            ref: "refs/heads/main",
            timestamp: "2024-01-01T00:00:00Z",
            activity_type: "push",
          },
        ],
        {
          headers: {
            Link: '<https://api.github.com/repos/octocat/repo/activity?after=cursor123>; rel="next"',
          },
        },
      );

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listRepoActivity("octocat", "repo");

      expect(result.nextCursor).toBe("cursor123");
      expect(result.activities).toHaveLength(1);
    });

    it("returns null cursor when no Link header", async () => {
      mockPool.intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" }).reply(200, []);

      const client = new GitHubClient({ dispatcher: mockAgent });
      const result = await client.listRepoActivity("octocat", "repo");

      expect(result.nextCursor).toBeNull();
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

    it("includes afterCursor in URL when provided", async () => {
      mockPool
        .intercept({
          path: /\/repos\/octocat\/repo\/activity\?.*per_page=20.*after=abc123|\/repos\/octocat\/repo\/activity\?.*after=abc123.*per_page=20/,
          method: "GET",
        })
        .reply(200, []);

      const client = new GitHubClient({ dispatcher: mockAgent });
      await client.listRepoActivity("octocat", "repo", 20, "abc123");
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
      const tags = await client.listRepoTags("octocat", "Hello-World");

      expect(tags).toHaveLength(2);
      expect(tags[0]).toEqual({ name: "v1.0.0", commit: { sha: "abc123" } });
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
  });
});
