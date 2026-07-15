import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GitHubClient } from "../../../../src/modules/github/client.js";
import { GitHubService } from "../../../../src/modules/github/service.js";
import { InvalidCursorError } from "../../../../src/utils/pagination.js";

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
    it("applies default owner and returns repos with count", async () => {
      mockClient.listOwnerRepos.mockResolvedValueOnce([
        { id: 1, name: "repo1" },
        { id: 2, name: "repo2" },
      ]);

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      const result = await service.listOwnerRepos();

      expect(mockClient.listOwnerRepos).toHaveBeenCalledWith("octocat", 30, undefined);
      expect(result.repos).toHaveLength(2);
      expect(result.count).toBe(2);
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
  });

  describe("listRepoTags", () => {
    it("returns tags with count", async () => {
      mockClient.listRepoTags.mockResolvedValueOnce([
        { name: "v1.0.0", commit: { sha: "abc123" } },
        { name: "v0.9.0", commit: { sha: "def456" } },
      ]);

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      const result = await service.listRepoTags();

      expect(result.tags).toHaveLength(2);
      expect(result.count).toBe(2);
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

    it("accepts cursor with matching type", async () => {
      const validCursor = Buffer.from("gh-activity:cursor123").toString("base64url");

      mockClient.listRepoActivity.mockResolvedValueOnce({
        activities: [],
        nextCursor: null,
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      await service.listRepoActivity("octocat", "repo", { cursor: validCursor });

      expect(mockClient.listRepoActivity).toHaveBeenCalledWith("octocat", "repo", 20, "cursor123", undefined);
    });

    it("returns paginated activities with cursor", async () => {
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
      });

      const service = new GitHubService(mockClient as unknown as GitHubClient);
      const result = await service.listRepoActivity("octocat", "repo");

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBe("Z2gtYWN0aXZpdHk6Y3Vyc29yMTIz");
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
