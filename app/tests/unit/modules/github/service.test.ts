import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GitHubClient } from "../../../../src/modules/github/client.js";
import { GitHubService } from "../../../../src/modules/github/service.js";
import { encodeCursor, InvalidCursorError } from "../../../../src/utils/pagination.js";

describe("GitHubService", () => {
  const mockClient = {
    getOwner: vi.fn(),
    listOwnerRepos: vi.fn(),
    getRepo: vi.fn(),
    listRepoActivity: vi.fn(),
    listRepoLanguages: vi.fn(),
    listRepoTags: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOwner", () => {
    it("applies default owner when not provided", async () => {
      mockClient.getOwner.mockResolvedValueOnce({ login: "octocat" });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      await service.getOwner();

      expect(mockClient.getOwner).toHaveBeenCalledWith("octocat", undefined);
    });

    it("uses provided owner", async () => {
      mockClient.getOwner.mockResolvedValueOnce({ login: "testuser" });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      const signal = new AbortController().signal;
      await service.getOwner("testuser", signal);

      expect(mockClient.getOwner).toHaveBeenCalledWith("testuser", signal);
    });
  });

  describe("listOwnerRepos", () => {
    it("applies the default owner and page size", async () => {
      mockClient.listOwnerRepos.mockResolvedValueOnce({
        items: [
          { id: 1, name: "repo1" },
          { id: 2, name: "repo2" },
        ],
        nextPage: null,
        prevPage: null,
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      const result = await service.listOwnerRepos();

      expect(mockClient.listOwnerRepos).toHaveBeenCalledWith("octocat", 20, 1, undefined);
      expect(result.items).toHaveLength(2);
    });

    it("translates GitHub page links into scope-bound opaque cursors", async () => {
      mockClient.listOwnerRepos.mockResolvedValueOnce({ items: [], nextPage: 2, prevPage: null });
      const service = new GitHubService(mockClient as unknown as GitHubClient);

      const result = await service.listOwnerRepos("octocat", { limit: 5 });

      expect(result.nextCursor).toBe(encodeCursor({ type: "listGitHubOwnerRepositories", value: "next:5:octocat:2" }));
    });

    it("rejects a repository cursor reused with a different owner or limit", async () => {
      const cursor = encodeCursor({ type: "listGitHubOwnerRepositories", value: "next:5:octocat:2" });
      const service = new GitHubService(mockClient as unknown as GitHubClient);

      await expect(service.listOwnerRepos("octocat", { cursor, limit: 10 })).rejects.toThrow(
        "cursor does not match the requested collection or limit",
      );
      await expect(service.listOwnerRepos("hubot", { cursor, limit: 5 })).rejects.toThrow(
        "cursor does not match the requested collection or limit",
      );
      expect(mockClient.listOwnerRepos).not.toHaveBeenCalled();
    });

    it("links a second repository page back to the cursorless first page", async () => {
      mockClient.listOwnerRepos.mockResolvedValueOnce({ items: [], nextPage: 3, prevPage: 1 });
      const cursor = encodeCursor({ type: "listGitHubOwnerRepositories", value: "next:5:octocat:2" });
      const service = new GitHubService(mockClient as unknown as GitHubClient);

      const result = await service.listOwnerRepos("octocat", { cursor, limit: 5 });

      expect(result.prevCursor).toBeNull();
      expect(mockClient.listOwnerRepos).toHaveBeenCalledWith("octocat", 5, 2, undefined);
    });

    it("encodes a non-first previous repository page", async () => {
      mockClient.listOwnerRepos.mockResolvedValueOnce({ items: [], nextPage: null, prevPage: 2 });
      const cursor = encodeCursor({ type: "listGitHubOwnerRepositories", value: "next:5:octocat:3" });
      const result = await new GitHubService(mockClient as unknown as GitHubClient).listOwnerRepos("octocat", {
        cursor,
        limit: 5,
      });
      expect(result.prevCursor).toBe(encodeCursor({ type: "listGitHubOwnerRepositories", value: "prev:5:octocat:2" }));
    });
  });

  describe("getRepo", () => {
    it("applies default owner and repo when not provided", async () => {
      mockClient.getRepo.mockResolvedValueOnce({ id: 1, name: "git-consortium" });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      await service.getRepo();

      expect(mockClient.getRepo).toHaveBeenCalledWith("octocat", "git-consortium", undefined);
    });

    it("uses provided owner and repo", async () => {
      mockClient.getRepo.mockResolvedValueOnce({ id: 1, name: "myrepo" });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      await service.getRepo("testuser", "myrepo");

      expect(mockClient.getRepo).toHaveBeenCalledWith("testuser", "myrepo", undefined);
    });
  });

  describe("listRepoLanguages", () => {
    it("transforms languages map to sorted array", async () => {
      mockClient.listRepoLanguages.mockResolvedValueOnce({
        TypeScript: 78769,
        JavaScript: 1234,
        Shell: 500,
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      const result = await service.listRepoLanguages();

      expect(result.languages).toEqual([
        { name: "TypeScript", bytes: 78769 },
        { name: "JavaScript", bytes: 1234 },
        { name: "Shell", bytes: 500 },
      ]);
    });

    it("returns empty array for repos with no languages", async () => {
      mockClient.listRepoLanguages.mockResolvedValueOnce({});

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      const result = await service.listRepoLanguages();

      expect(result.languages).toEqual([]);
    });

    it("breaks equal byte counts by Unicode scalar order", async () => {
      mockClient.listRepoLanguages.mockResolvedValueOnce({ 𐀀: 10, "": 10 });
      const result = await new GitHubService(mockClient as unknown as GitHubClient).listRepoLanguages();
      expect(result.languages.map(({ name }) => name)).toEqual(["", "𐀀"]);
    });
  });

  describe("listRepoTags", () => {
    it("returns a page of tags", async () => {
      mockClient.listRepoTags.mockResolvedValueOnce({
        items: [
          { name: "v1.0.0", commit: { sha: "abc123" } },
          { name: "v0.9.0", commit: { sha: "def456" } },
        ],
        nextPage: null,
        prevPage: null,
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      const result = await service.listRepoTags();

      expect(result.items).toHaveLength(2);
      expect(mockClient.listRepoTags).toHaveBeenCalledWith("octocat", "git-consortium", 20, 1, undefined);
    });

    it("translates both numbered tag directions", async () => {
      mockClient.listRepoTags.mockResolvedValueOnce({ items: [], nextPage: 4, prevPage: 2 });
      const cursor = encodeCursor({ type: "listGitHubRepositoryTags", value: "next:5:octocat%2Frepo:3" });
      const result = await new GitHubService(mockClient as unknown as GitHubClient).listRepoTags("octocat", "repo", {
        cursor,
        limit: 5,
      });
      expect(result.nextCursor).toBe(
        encodeCursor({ type: "listGitHubRepositoryTags", value: "next:5:octocat%2Frepo:4" }),
      );
      expect(result.prevCursor).toBe(
        encodeCursor({ type: "listGitHubRepositoryTags", value: "prev:5:octocat%2Frepo:2" }),
      );
    });
  });

  describe("listRepoActivity", () => {
    it.each(["", "invalid!!!"])("rejects malformed cursor %j before calling GitHub", async (cursor) => {
      const service = new GitHubService(mockClient as unknown as GitHubClient);

      await expect(service.listRepoActivity("octocat", "repo", { cursor })).rejects.toThrow(InvalidCursorError);
      expect(mockClient.listRepoActivity).not.toHaveBeenCalled();
    });

    it("throws InvalidCursorError for cursor type mismatch", async () => {
      const wrongTypeCursor = Buffer.from("wrong-type:somevalue").toString("base64url");

      const service = new GitHubService(mockClient as unknown as GitHubClient);

      await expect(service.listRepoActivity("octocat", "repo", { cursor: wrongTypeCursor })).rejects.toThrow(
        InvalidCursorError,
      );
    });

    it.each([
      encodeCursor({ type: "listGitHubRepositoryActivity", value: "sideways:20:octocat%2Frepo:2:value" }),
      encodeCursor({ type: "listGitHubRepositoryActivity", value: "next:20:%E0%A4%A:2:value" }),
      encodeCursor({ type: "listGitHubRepositoryActivity", value: "next:20:octocat%2Frepo:2:" }),
      encodeCursor({ type: "listGitHubRepositoryActivity", value: "next:20:octocat%2Frepo:1:value" }),
      encodeCursor({ type: "listGitHubRepositoryActivity", value: "next:20:octocat%2Frepo:02:value" }),
    ])("rejects invalid decoded activity state", async (cursor) => {
      await expect(
        new GitHubService(mockClient as unknown as GitHubClient).listRepoActivity("octocat", "repo", { cursor }),
      ).rejects.toThrow(InvalidCursorError);
      expect(mockClient.listRepoActivity).not.toHaveBeenCalled();
    });

    it.each([
      encodeCursor({ type: "listGitHubOwnerRepositories", value: "next:20:octocat:1" }),
      encodeCursor({ type: "listGitHubOwnerRepositories", value: "next:20:%E0%A4%A:2" }),
      encodeCursor({ type: "listGitHubRepositoryTags", value: "next:20:octocat%2Frepo:2" }),
    ])("rejects impossible or wrong-operation numbered state", async (cursor) => {
      await expect(
        new GitHubService(mockClient as unknown as GitHubClient).listOwnerRepos("octocat", { cursor }),
      ).rejects.toThrow(InvalidCursorError);
      expect(mockClient.listOwnerRepos).not.toHaveBeenCalled();
    });

    it("decodes a forward cursor for GitHub's after parameter", async () => {
      const validCursor = encodeCursor({
        type: "listGitHubRepositoryActivity",
        value: "next:20:octocat%2Frepo:2:cursor123",
      });

      mockClient.listRepoActivity.mockResolvedValueOnce({
        activities: [],
        nextCursor: null,
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      await service.listRepoActivity("octocat", "repo", { cursor: validCursor });

      expect(mockClient.listRepoActivity).toHaveBeenCalledWith(
        "octocat",
        "repo",
        20,
        { direction: "after", value: "cursor123" },
        undefined,
      );
    });

    it("decodes a backward cursor for GitHub's before parameter", async () => {
      const validCursor = encodeCursor({
        type: "listGitHubRepositoryActivity",
        value: "prev:20:octocat%2Frepo:2:cursor456",
      });
      mockClient.listRepoActivity.mockResolvedValueOnce({ activities: [], nextCursor: null, prevCursor: null });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      await service.listRepoActivity("octocat", "repo", { cursor: validCursor });

      expect(mockClient.listRepoActivity).toHaveBeenCalledWith(
        "octocat",
        "repo",
        20,
        { direction: "before", value: "cursor456" },
        undefined,
      );
    });

    it("rejects an activity cursor reused with a different repository or limit", async () => {
      const cursor = encodeCursor({
        type: "listGitHubRepositoryActivity",
        value: "next:20:octocat%2Frepo:2:cursor123",
      });
      const service = new GitHubService(mockClient as unknown as GitHubClient);

      await expect(service.listRepoActivity("octocat", "repo", { cursor, limit: 10 })).rejects.toThrow(
        "cursor does not match the requested collection or limit",
      );
      await expect(service.listRepoActivity("octocat", "other", { cursor, limit: 20 })).rejects.toThrow(
        "cursor does not match the requested collection or limit",
      );
      expect(mockClient.listRepoActivity).not.toHaveBeenCalled();
    });

    it("keeps cursor-bearing links when navigating beyond the second activity page", async () => {
      const currentCursor = encodeCursor({
        type: "listGitHubRepositoryActivity",
        value: "next:20:octocat%2Frepo:3:current-page",
      });
      mockClient.listRepoActivity.mockResolvedValueOnce({
        activities: [
          {
            id: 1,
            actor: "user",
            ref: "refs/heads/main",
            timestamp: "2024-01-01T00:00:00Z",
            activityType: "push",
            actorAvatarUrl: "",
          },
        ],
        nextCursor: "cursor123",
        prevCursor: "cursor456",
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      const result = await service.listRepoActivity("octocat", "repo", { cursor: currentCursor });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBe(
        encodeCursor({ type: "listGitHubRepositoryActivity", value: "next:20:octocat%2Frepo:4:cursor123" }),
      );
      expect(result.prevCursor).toBe(
        encodeCursor({ type: "listGitHubRepositoryActivity", value: "prev:20:octocat%2Frepo:2:cursor456" }),
      );
    });

    it("links the second activity page back to the cursorless first page", async () => {
      const currentCursor = encodeCursor({
        type: "listGitHubRepositoryActivity",
        value: "next:20:octocat%2Frepo:2:current-page",
      });
      mockClient.listRepoActivity.mockResolvedValueOnce({
        activities: [],
        nextCursor: "next-page",
        prevCursor: "first-page",
      });
      const service = new GitHubService(mockClient as unknown as GitHubClient);

      const result = await service.listRepoActivity("octocat", "repo", { cursor: currentCursor });

      expect(result.prevCursor).toBeNull();
      expect(result.nextCursor).toBe(
        encodeCursor({ type: "listGitHubRepositoryActivity", value: "next:20:octocat%2Frepo:3:next-page" }),
      );
    });

    it("returns undefined nextCursor when no more pages", async () => {
      mockClient.listRepoActivity.mockResolvedValueOnce({
        activities: [
          {
            id: 1,
            actor: "user",
            ref: "refs/heads/main",
            timestamp: "2024-01-01T00:00:00Z",
            activityType: "push",
            actorAvatarUrl: "",
          },
        ],
        nextCursor: null,
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      const result = await service.listRepoActivity("octocat", "repo");

      expect(result.nextCursor).toBeUndefined();
    });

    it("uses default limit of 20", async () => {
      mockClient.listRepoActivity.mockResolvedValueOnce({
        activities: [],
        nextCursor: null,
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      await service.listRepoActivity("octocat", "repo", {});

      expect(mockClient.listRepoActivity).toHaveBeenCalledWith("octocat", "repo", 20, undefined, undefined);
    });

    it("uses custom limit when provided", async () => {
      mockClient.listRepoActivity.mockResolvedValueOnce({
        activities: [],
        nextCursor: null,
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      await service.listRepoActivity("octocat", "repo", { limit: 50 });

      expect(mockClient.listRepoActivity).toHaveBeenCalledWith("octocat", "repo", 50, undefined, undefined);
    });

    it("uses default owner and repo when not provided", async () => {
      mockClient.listRepoActivity.mockResolvedValueOnce({
        activities: [],
        nextCursor: null,
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      await service.listRepoActivity();

      expect(mockClient.listRepoActivity).toHaveBeenCalledWith("octocat", "git-consortium", 20, undefined, undefined);
    });
  });
});

describe("GitHubService credential boundary", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("never derives an outbound credential from the process GITHUB_TOKEN", async () => {
    vi.stubEnv("GITHUB_TOKEN", "private-resource-capable-canary");

    const clientModule = await import("../../../../src/modules/github/client.js");
    const constructorSpy = vi.spyOn(clientModule, "GitHubClient");

    const serviceModule = await import("../../../../src/modules/github/service.js");
    new serviceModule.GitHubService();

    expect(constructorSpy).toHaveBeenCalledWith();
  });
});
