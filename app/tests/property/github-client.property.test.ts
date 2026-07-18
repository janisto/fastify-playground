import { fc, test } from "@fast-check/vitest";
import { MockAgent } from "undici";
import { expect } from "vitest";
import { GitHubClient } from "../../src/modules/github/client.js";
import { propertyParameters } from "./config.js";

const cursor = fc.stringMatching(/^[A-Za-z0-9._~-]{1,64}$/);
const optionalWhitespace = fc.constantFrom("", " ", "\t");
const activityPath = /\/repos\/octocat\/repo\/activity/;

async function requestWithLinkHeader(link: string): Promise<{ nextCursor: string | null; prevCursor: string | null }> {
  const mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  mockAgent
    .get("https://api.github.com")
    .intercept({ method: "GET", path: activityPath })
    .reply(200, [], { headers: { Link: link } });

  try {
    const client = new GitHubClient({ dispatcher: mockAgent });
    const result = await client.listRepoActivity("octocat", "repo");
    mockAgent.assertNoPendingInterceptors();
    return { nextCursor: result.nextCursor, prevCursor: result.prevCursor };
  } finally {
    await mockAgent.close();
  }
}

function linkUrl(parameters: Readonly<Record<string, string>>): string {
  const url = new URL("https://api.github.com/repos/octocat/repo/activity");
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
  return url.toString();
}

test.prop([cursor, cursor, cursor, fc.boolean(), optionalWhitespace], propertyParameters)(
  "selects only the cursor owned by each GitHub Link relation",
  async (after, before, unrelated, reverse, whitespace) => {
    const members = [
      `<${linkUrl({ after, before: unrelated })}>; rel="next"`,
      `<${linkUrl({ after: unrelated, before })}>; rel="prev"`,
      `<${linkUrl({ after: unrelated, before: unrelated })}>; rel="last"`,
    ];
    const link = (reverse ? members.toReversed() : members).join(`${whitespace},${whitespace}`);

    await expect(requestWithLinkHeader(link)).resolves.toEqual({
      nextCursor: after,
      prevCursor: before,
    });
  },
);

const invalidMember = cursor.chain((value) =>
  fc.constantFrom(
    '<not-a-valid-url>; rel="next"',
    `<${linkUrl({ page: "2" })}>; rel="next"`,
    `<${linkUrl({ after: value })}>; rel="last"`,
    `<${linkUrl({ before: value })}>; rel="next"`,
    `${linkUrl({ after: value })}; rel="next"`,
  ),
);

test.prop([invalidMember], propertyParameters)(
  "ignores malformed, incomplete, and wrong-relation GitHub Link members",
  async (link) => {
    await expect(requestWithLinkHeader(link)).resolves.toEqual({
      nextCursor: null,
      prevCursor: null,
    });
  },
);
