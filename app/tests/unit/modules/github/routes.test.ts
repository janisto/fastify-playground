import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as githubService from "../../../../src/modules/github/service.js";

describe("GitHub routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("GET /owners/:owner returns owner data", async () => {
    const spy = vi.spyOn(githubService.GitHubService.prototype, "getOwner");
    spy.mockResolvedValueOnce({
      login: "octocat",
      id: 1,
      avatarUrl: "https://example.com/avatar",
      htmlUrl: "https://github.com/octocat",
      type: "User",
      name: "The Octocat",
      company: null,
      blog: null,
      location: null,
      bio: null,
      publicRepos: 8,
      followers: 1000,
      following: 0,
      createdAt: "2011-01-25T18:44:36.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const fastify = Fastify();
    const { default: githubRoutes } = await import("../../../../src/modules/github/routes.js");
    fastify.register(githubRoutes);
    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      url: "/owners/octocat",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ login: "octocat" });
    expect(spy).toHaveBeenCalledWith("octocat", expect.any(AbortSignal));

    await fastify.close();
  });

  it("passes an unconventional account name upstream instead of guessing GitHub naming policy", async () => {
    const spy = vi.spyOn(githubService.GitHubService.prototype, "getOwner");
    spy.mockResolvedValueOnce({
      login: "managed_account",
      id: 1,
      avatarUrl: "https://example.com/avatar",
      htmlUrl: "https://github.com/managed_account",
      type: "User",
      name: null,
      company: null,
      blog: null,
      location: null,
      bio: null,
      publicRepos: 0,
      followers: 0,
      following: 0,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const fastify = Fastify();
    const { default: githubRoutes } = await import("../../../../src/modules/github/routes.js");
    fastify.register(githubRoutes);
    await fastify.ready();

    const response = await fastify.inject({ method: "GET", url: "/owners/managed_account" });

    expect(response.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledWith("managed_account", expect.any(AbortSignal));
    await fastify.close();
  });

  it("GET /owners/:owner/repos returns repository list", async () => {
    const spy = vi.spyOn(githubService.GitHubService.prototype, "listOwnerRepos");
    spy.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          name: "Hello-World",
          fullName: "octocat/Hello-World",
          description: "My first repository",
          htmlUrl: "https://github.com/octocat/Hello-World",
          fork: false,
        },
      ],
      nextCursor: "repos-page-2",
    });

    const fastify = Fastify();
    const { default: githubRoutes } = await import("../../../../src/modules/github/routes.js");
    fastify.register(githubRoutes);
    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      url: "/owners/octocat/repos",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      repos: [{ name: "Hello-World" }],
      count: 1,
    });
    expect(response.headers.link).toBe('</v1/github/owners/octocat/repos?cursor=repos-page-2&limit=20>; rel="next"');
    expect(spy).toHaveBeenCalledWith("octocat", { limit: 20 }, expect.any(AbortSignal));

    await fastify.close();
  });

  it("GET /repos/:owner/:repo returns repository details", async () => {
    const spy = vi.spyOn(githubService.GitHubService.prototype, "getRepo");
    spy.mockResolvedValueOnce({
      id: 1,
      name: "Hello-World",
      fullName: "octocat/Hello-World",
      description: "My first repository",
      htmlUrl: "https://github.com/octocat/Hello-World",
      language: "JavaScript",
      stargazersCount: 100,
      forksCount: 50,
      openIssuesCount: 5,
      fork: false,
      archived: false,
      createdAt: "2011-01-25T18:44:36.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      pushedAt: "2024-01-01T00:00:00.000Z",
      defaultBranch: "main",
      license: "MIT",
      topics: ["javascript"],
      disabled: false,
    });

    const fastify = Fastify();
    const { default: githubRoutes } = await import("../../../../src/modules/github/routes.js");
    fastify.register(githubRoutes);
    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      url: "/repos/octocat/Hello-World",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: "Hello-World", defaultBranch: "main" });

    await fastify.close();
  });

  it("GET /repos/:owner/:repo/activity returns activities with Link header", async () => {
    const spy = vi.spyOn(githubService.GitHubService.prototype, "listRepoActivity");
    spy.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          actor: "user",
          ref: "refs/heads/main",
          timestamp: "2024-01-01T00:00:00Z",
          activityType: "push",
          actorAvatarUrl: "https://example.com/avatar",
        },
      ],
      nextCursor: "abc123",
      prevCursor: "previous123",
    });

    const fastify = Fastify();
    const { default: githubRoutes } = await import("../../../../src/modules/github/routes.js");
    fastify.register(githubRoutes);
    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      url: "/repos/managed_account/repo-name/activity",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ activities: [{ actor: "user" }], count: 1 });
    expect(response.headers.link).toBe(
      '</v1/github/repos/managed_account/repo-name/activity?cursor=abc123&limit=20>; rel="next", </v1/github/repos/managed_account/repo-name/activity?cursor=previous123&limit=20>; rel="prev"',
    );
    expect(spy).toHaveBeenCalledWith("managed_account", "repo-name", { limit: 20 }, expect.any(AbortSignal));

    await fastify.close();
  });

  it("GET /repos/:owner/:repo/activity returns no Link header when no next page", async () => {
    const spy = vi.spyOn(githubService.GitHubService.prototype, "listRepoActivity");
    spy.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          actor: "user",
          ref: "refs/heads/main",
          timestamp: "2024-01-01T00:00:00Z",
          activityType: "push",
          actorAvatarUrl: "https://example.com/avatar",
        },
      ],
    });

    const fastify = Fastify();
    const { default: githubRoutes } = await import("../../../../src/modules/github/routes.js");
    fastify.register(githubRoutes);
    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      url: "/repos/octocat/Hello-World/activity",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ activities: [{ actor: "user" }], count: 1 });
    expect(response.headers.link).toBeUndefined();

    await fastify.close();
  });

  it("GET /repos/:owner/:repo/activity links the second page to the cursorless first page", async () => {
    vi.spyOn(githubService.GitHubService.prototype, "listRepoActivity").mockResolvedValueOnce({
      items: [],
      prevCursor: null,
    });
    const fastify = Fastify();
    const { default: githubRoutes } = await import("../../../../src/modules/github/routes.js");
    fastify.register(githubRoutes);

    const response = await fastify.inject({
      method: "GET",
      url: "/repos/octocat/repo/activity?cursor=second-page&limit=20",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.link).toBe('</v1/github/repos/octocat/repo/activity?limit=20>; rel="prev"');
    await fastify.close();
  });

  it("GET /repos/:owner/:repo/languages returns languages", async () => {
    const spy = vi.spyOn(githubService.GitHubService.prototype, "listRepoLanguages");
    spy.mockResolvedValueOnce({
      languages: [
        { name: "TypeScript", bytes: 78769 },
        { name: "JavaScript", bytes: 1234 },
      ],
    });

    const fastify = Fastify();
    const { default: githubRoutes } = await import("../../../../src/modules/github/routes.js");
    fastify.register(githubRoutes);
    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      url: "/repos/octocat/Hello-World/languages",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      languages: [
        { name: "TypeScript", bytes: 78769 },
        { name: "JavaScript", bytes: 1234 },
      ],
    });

    await fastify.close();
  });

  it("GET /repos/:owner/:repo/tags returns tag list", async () => {
    const spy = vi.spyOn(githubService.GitHubService.prototype, "listRepoTags");
    spy.mockResolvedValueOnce({
      items: [
        { name: "v1.0.0", commit: { sha: "abc123" } },
        { name: "v0.9.0", commit: { sha: "def456" } },
      ],
      nextCursor: "tags-page-2",
    });

    const fastify = Fastify();
    const { default: githubRoutes } = await import("../../../../src/modules/github/routes.js");
    fastify.register(githubRoutes);
    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      url: "/repos/octocat/Hello-World/tags",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tags: [{ name: "v1.0.0" }, { name: "v0.9.0" }],
      count: 2,
    });
    expect(response.headers.link).toBe(
      '</v1/github/repos/octocat/Hello-World/tags?cursor=tags-page-2&limit=20>; rel="next"',
    );
    expect(spy).toHaveBeenCalledWith("octocat", "Hello-World", { limit: 20 }, expect.any(AbortSignal));

    await fastify.close();
  });
});
