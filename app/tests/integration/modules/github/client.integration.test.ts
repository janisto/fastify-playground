import { beforeAll, describe, expect, it } from "vitest";

const GITHUB_TOKEN = process.env["GITHUB_TOKEN"];
const clientOptions = GITHUB_TOKEN ? { token: GITHUB_TOKEN } : {};

describe.skipIf(!GITHUB_TOKEN)("GitHubClient integration", () => {
  let GitHubClient: typeof import("../../../../src/modules/github/client.js").GitHubClient;

  beforeAll(async () => {
    const clientModule = await import("../../../../src/modules/github/client.js");
    GitHubClient = clientModule.GitHubClient;
  });

  it("fetches real owner data", async () => {
    const client = new GitHubClient(clientOptions);
    const owner = await client.getOwner("octocat");

    expect(owner.login).toBe("octocat");
    expect(owner.id).toBeGreaterThan(0);
    expect(owner.type).toBe("User");
  });

  it("returns 404 error for non-existent owner", async () => {
    const client = new GitHubClient(clientOptions);

    await expect(client.getOwner("__nonexistent_user_xyz123__")).rejects.toMatchObject({
      name: "GitHubApiError",
      code: "github_not_found",
      statusCode: 404,
    });
  });

  it("fetches repository languages", async () => {
    const client = new GitHubClient(clientOptions);
    const languages = await client.listRepoLanguages("octocat", "git-consortium");

    expect(languages).toEqual(expect.any(Object));
  });

  it("fetches repository details", async () => {
    const client = new GitHubClient(clientOptions);
    const repo = await client.getRepo("octocat", "git-consortium");

    expect(repo.name).toBe("git-consortium");
    expect(repo.fullName).toBe("octocat/git-consortium");
    expect(repo.defaultBranch.length).toBeGreaterThan(0);
  });

  it("lists owner repositories", async () => {
    const client = new GitHubClient(clientOptions);
    const repos = await client.listOwnerRepos("octocat");

    expect(repos.length).toBeGreaterThan(0);
    expect(repos[0]).toMatchObject({ fullName: expect.stringContaining("octocat/") });
  });

  it("lists repository tags", async () => {
    const client = new GitHubClient(clientOptions);
    const tags = await client.listRepoTags("octocat", "git-consortium");

    expect(tags).toEqual(expect.any(Array));
  });

  it("lists repository activity", async () => {
    const client = new GitHubClient(clientOptions);
    const result = await client.listRepoActivity("octocat", "git-consortium");

    expect(result.activities).toEqual(expect.any(Array));
    expect(result.nextCursor === null || typeof result.nextCursor === "string").toBe(true);
  });
});
