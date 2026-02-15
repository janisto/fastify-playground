import { beforeAll, describe, expect, it } from "vitest";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

describe.skipIf(!GITHUB_TOKEN)("GitHubClient integration", () => {
  let GitHubClient: typeof import("../../../../src/modules/github/client.js").GitHubClient;

  beforeAll(async () => {
    const clientModule = await import("../../../../src/modules/github/client.js");
    GitHubClient = clientModule.GitHubClient;
  });

  it("fetches real owner data", async () => {
    const client = new GitHubClient({ token: GITHUB_TOKEN });
    const owner = await client.getOwner("octocat");

    expect(owner.login).toBe("octocat");
    expect(owner.id).toBeGreaterThan(0);
    expect(owner.type).toBe("User");
  });

  it("returns 404 error for non-existent owner", async () => {
    const client = new GitHubClient({ token: GITHUB_TOKEN });

    await expect(client.getOwner("__nonexistent_user_xyz123__")).rejects.toMatchObject({
      name: "GitHubApiError",
      code: "github_not_found",
      statusCode: 404,
    });
  });

  it("fetches repository languages", async () => {
    const client = new GitHubClient({ token: GITHUB_TOKEN });
    const languages = await client.listRepoLanguages("octocat", "git-consortium");

    expect(languages).toBeDefined();
    expect(typeof languages).toBe("object");
  });

  it("fetches repository details", async () => {
    const client = new GitHubClient({ token: GITHUB_TOKEN });
    const repo = await client.getRepo("octocat", "git-consortium");

    expect(repo.name).toBe("git-consortium");
    expect(repo.fullName).toBe("octocat/git-consortium");
    expect(repo.defaultBranch).toBeDefined();
  });

  it("lists owner repositories", async () => {
    const client = new GitHubClient({ token: GITHUB_TOKEN });
    const repos = await client.listOwnerRepos("octocat");

    expect(Array.isArray(repos)).toBe(true);
    expect(repos.length).toBeGreaterThan(0);
  });

  it("lists repository tags", async () => {
    const client = new GitHubClient({ token: GITHUB_TOKEN });
    const tags = await client.listRepoTags("octocat", "git-consortium");

    expect(Array.isArray(tags)).toBe(true);
  });

  it("lists repository activity", async () => {
    const client = new GitHubClient({ token: GITHUB_TOKEN });
    const result = await client.listRepoActivity("octocat", "git-consortium");

    expect(result.activities).toBeDefined();
    expect(Array.isArray(result.activities)).toBe(true);
  });
});
