import { fc, test } from "@fast-check/vitest";
import { MockAgent } from "undici";
import { expect } from "vitest";
import { GitHubClient } from "../../src/modules/github/client.js";
import { propertyParameters } from "./config.js";

const providerCursor = fc.stringMatching(/^[A-Za-z0-9._~-]{1,64}$/);

async function requestWithLink(link: string, current?: string) {
  const agent = new MockAgent();
  agent.disableNetConnect();
  agent
    .get("https://api.github.com")
    .intercept({ method: "GET", path: /\/repos\/octocat\/repo\/activity/ })
    .reply(
      200,
      [
        {
          id: 1,
          actor: null,
          ref: "refs/heads/main",
          timestamp: "2024-01-01T00:00:00.000Z",
          activity_type: "push",
        },
      ],
      { headers: { "content-type": "application/json", link } },
    );
  try {
    return await new GitHubClient({ dispatcher: agent }).listRepoActivity(
      "octocat",
      "repo",
      20,
      current === undefined ? undefined : { direction: "after", value: current },
    );
  } finally {
    await agent.close();
  }
}

test.prop([providerCursor], propertyParameters)(
  "extracts only an allowlisted next activity value without following the target",
  async (value) => {
    const url = new URL("https://api.github.com/repos/octocat/repo/activity");
    url.search = new URLSearchParams({ direction: "desc", per_page: "20", after: value }).toString();
    const result = await requestWithLink(`<${url}>; rel="next"`);
    expect(result.nextCursor).toBe(value);
    expect(result.prevCursor).toBeNull();
  },
);

test.prop(
  [providerCursor, fc.constantFrom("cross-origin", "wrong-query", "repeated", "no-progress")],
  propertyParameters,
)("fails closed on unsafe, ambiguous, or non-progressing navigation", async (value, kind) => {
  const good = `https://api.github.com/repos/octocat/repo/activity?direction=desc&per_page=20&after=${encodeURIComponent(value)}`;
  const link =
    kind === "cross-origin"
      ? `<https://attacker.invalid/repos/octocat/repo/activity?direction=desc&per_page=20&after=${value}>; rel="next"`
      : kind === "wrong-query"
        ? `<${good}&page=2>; rel="next"`
        : kind === "repeated"
          ? `<${good}>; rel="next", <${good}>; rel="next"`
          : `<${good}>; rel="next"`;
  await expect(requestWithLink(link, kind === "no-progress" ? value : "current")).rejects.toMatchObject({
    code: "github_upstream",
    statusCode: 502,
  });
});
