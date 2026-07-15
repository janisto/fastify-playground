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
      createdAt: "2011-01-25T18:44:36Z",
      updatedAt: "2024-01-01T00:00:00Z",
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

    await fastify.close();
  });

  it("GET /owners/:owner/repos returns repository list", async () => {
    const spy = vi.spyOn(githubService.GitHubService.prototype, "listOwnerRepos");
    spy.mockResolvedValueOnce({
      repos: [
        {
          id: 1,
          name: "Hello-World",
          fullName: "octocat/Hello-World",
          description: "My first repository",
          htmlUrl: "https://github.com/octocat/Hello-World",
          language: "JavaScript",
          stargazersCount: 100,
          forksCount: 50,
          openIssuesCount: 5,
          visibility: "public",
          fork: false,
          archived: false,
          createdAt: "2011-01-25T18:44:36Z",
          updatedAt: "2024-01-01T00:00:00Z",
          pushedAt: "2024-01-01T00:00:00Z",
        },
      ],
      count: 1,
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
      visibility: "public",
      fork: false,
      archived: false,
      createdAt: "2011-01-25T18:44:36Z",
      updatedAt: "2024-01-01T00:00:00Z",
      pushedAt: "2024-01-01T00:00:00Z",
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
    expect(response.headers.link).toContain('rel="next"');

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
      tags: [
        { name: "v1.0.0", commit: { sha: "abc123" } },
        { name: "v0.9.0", commit: { sha: "def456" } },
      ],
      count: 2,
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

    await fastify.close();
  });
});
