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

const JSON_HEADERS = { "content-type": "application/json" };
const OWNER = {
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
  created_at: "2011-01-25T18:44:36.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
} as const;
const SUMMARY = {
  id: 2,
  name: "repo",
  full_name: "octocat/repo",
  description: null,
  html_url: "https://github.com/octocat/repo",
  fork: false,
  private: false,
  visibility: "public",
} as const;
const DETAIL = {
  ...SUMMARY,
  language: "TypeScript",
  stargazers_count: 4,
  forks_count: 3,
  open_issues_count: 2,
  archived: false,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-02T00:00:00.000Z",
  pushed_at: null,
  default_branch: "main",
  license: { spdx_id: "MIT" },
  topics: ["z", "A", "a"],
  disabled: false,
} as const;
const ACTIVITY = {
  id: 3,
  actor: { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/1" },
  ref: "refs/heads/main",
  timestamp: "2024-01-03T00:00:00.000Z",
  activity_type: "push",
} as const;
const TAG = { name: "v1.0.0", commit: { sha: "a".repeat(40) } } as const;

class PartialBodyTimeoutDispatcher extends Dispatcher {
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
    handler.onResponseStart?.(controller, 200, JSON_HEADERS, "OK");
    handler.onResponseData?.(controller, Buffer.from('{"login":'));
    queueMicrotask(() => handler.onResponseError?.(controller, new errors.BodyTimeoutError()));
    return true;
  }
}

describe("GitHubClient", () => {
  let agent: MockAgent;
  let pool: ReturnType<MockAgent["get"]>;

  beforeEach(() => {
    agent = new MockAgent();
    agent.disableNetConnect();
    pool = agent.get("https://api.github.com");
  });

  afterEach(async () => agent.close());

  it("sends the four literal anonymous provider headers", async () => {
    pool
      .intercept({
        path: "/users/octocat",
        method: "GET",
        headers(headers) {
          expect(headers["accept"]).toBe("application/vnd.github+json");
          expect(headers["x-github-api-version"]).toBe("2026-03-10");
          expect(headers["user-agent"]).toBe("fastify-playground");
          expect(headers["accept-encoding"]).toBe("identity");
          expect(headers["authorization"]).toBeUndefined();
          return true;
        },
      })
      .reply(200, OWNER, { headers: JSON_HEADERS });

    await expect(new GitHubClient({ dispatcher: agent }).getOwner("octocat")).resolves.toMatchObject({ id: 1 });
  });

  it("permits an explicit token only at the direct-client boundary", async () => {
    pool
      .intercept({ path: "/users/octocat", method: "GET", headers: { authorization: "Bearer smoke-token" } })
      .reply(200, OWNER, { headers: JSON_HEADERS });
    await new GitHubClient({ dispatcher: agent, token: "smoke-token" }).getOwner("octocat");
  });

  it("follows a same-origin numeric resource redirect without changing the query", async () => {
    pool.intercept({ path: "/users/octocat", method: "GET" }).reply(301, "", {
      headers: { location: "/user/1" },
    });
    pool.intercept({ path: "/user/1", method: "GET" }).reply(200, OWNER, { headers: JSON_HEADERS });
    await expect(new GitHubClient({ dispatcher: agent }).getOwner("octocat")).resolves.toMatchObject({
      login: "octocat",
    });
  });

  it.each([
    "https://attacker.invalid/users/octocat",
    "https://api.github.com/users/other",
    "https://user@api.github.com/users/octocat",
  ])("rejects unsafe redirect target %s", async (location) => {
    pool.intercept({ path: "/users/octocat", method: "GET" }).reply(302, "", { headers: { location } });
    await expect(new GitHubClient({ dispatcher: agent }).getOwner("octocat")).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
      statusCode: 502,
    });
  });

  it("rejects redirect loops", async () => {
    pool.intercept({ path: "/users/loop", method: "GET" }).reply(302, "", { headers: { location: "/users/loop" } });
    await expect(new GitHubClient({ dispatcher: agent }).getOwner("loop")).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
    });
  });

  it("constructs the fixed owner-repository query and preserves provider order", async () => {
    pool
      .intercept({
        path: "/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=2",
        method: "GET",
      })
      .reply(200, [SUMMARY, { ...SUMMARY, id: 4, name: "z", full_name: "octocat/z" }], {
        headers: JSON_HEADERS,
      });
    const result = await new GitHubClient({ dispatcher: agent }).listOwnerRepos("octocat", 2);
    expect(result.items.map(({ name }) => name)).toEqual(["repo", "z"]);
  });

  it("validates numbered links without following them", async () => {
    pool.intercept({ path: /\/users\/octocat\/repos/, method: "GET" }).reply(200, [SUMMARY], {
      headers: {
        ...JSON_HEADERS,
        link: '<https://api.github.com/user/1/repos?type=owner&sort=full_name&direction=asc&per_page=5&page=3>; rel="next", <https://api.github.com/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=5&page=1>; rel="prev"',
      },
    });
    await expect(new GitHubClient({ dispatcher: agent }).listOwnerRepos("octocat", 5, 2)).resolves.toMatchObject({
      nextPage: 3,
      prevPage: 1,
    });
  });

  it("accepts a lower non-adjacent previous page on a later empty page", async () => {
    pool.intercept({ path: /page=4/, method: "GET" }).reply(200, [], {
      headers: {
        ...JSON_HEADERS,
        link: '<https://api.github.com/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=5&page=1>; rel="prev"',
      },
    });

    await expect(new GitHubClient({ dispatcher: agent }).listOwnerRepos("octocat", 5, 4)).resolves.toMatchObject({
      items: [],
      nextPage: null,
      prevPage: 1,
    });
  });

  it.each([
    '<https://attacker.invalid/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=5&page=3>; rel="next"',
    '<https://api.github.com/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=5&page=2>; rel="next"',
    '<https://api.github.com/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=5&page=3>; rel="next", <https://api.github.com/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=5&page=4>; rel="next"',
    '<https://api.github.com/repositories/1/repos?type=owner&sort=full_name&direction=asc&per_page=5&page=3>; rel="next"',
  ])("rejects unsafe or ambiguous numbered navigation", async (link) => {
    pool.intercept({ path: /\/users\/octocat\/repos/, method: "GET" }).reply(200, [SUMMARY], {
      headers: { ...JSON_HEADERS, link },
    });
    await expect(new GitHubClient({ dispatcher: agent }).listOwnerRepos("octocat", 5, 2)).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
    });
  });

  it("fails closed on non-public or over-limit repository pages", async () => {
    pool.intercept({ path: /\/users\/octocat\/repos/, method: "GET" }).reply(200, [{ ...SUMMARY, private: true }], {
      headers: JSON_HEADERS,
    });
    await expect(new GitHubClient({ dispatcher: agent }).listOwnerRepos("octocat", 1)).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
    });
  });

  it("projects a public repository and scalar-sorts topics", async () => {
    pool.intercept({ path: "/repos/octocat/repo", method: "GET" }).reply(200, DETAIL, { headers: JSON_HEADERS });
    await expect(new GitHubClient({ dispatcher: agent }).getRepo("octocat", "repo")).resolves.toMatchObject({
      license: "MIT",
      pushedAt: null,
      topics: ["A", "a", "z"],
    });
  });

  it("maps absent display fields, license, and topics to explicit public null or empty values", async () => {
    pool.intercept({ path: "/users/octocat", method: "GET" }).reply(
      200,
      {
        ...OWNER,
        name: undefined,
        company: "",
        blog: null,
        location: undefined,
        bio: "",
      },
      { headers: { "content-type": "application/vnd.github+json; charset=utf-8" } },
    );
    pool.intercept({ path: "/repos/octocat/repo", method: "GET" }).reply(
      200,
      {
        ...DETAIL,
        description: "",
        license: { spdx_id: "NOASSERTION" },
        topics: undefined,
      },
      { headers: JSON_HEADERS },
    );
    const client = new GitHubClient({ dispatcher: agent });
    await expect(client.getOwner("octocat")).resolves.toMatchObject({
      name: null,
      company: null,
      blog: null,
      location: null,
      bio: null,
    });
    await expect(client.getRepo("octocat", "repo")).resolves.toMatchObject({
      description: null,
      license: null,
      topics: [],
    });
  });

  it.each([
    { ...DETAIL, private: true },
    { ...DETAIL, visibility: "private" },
    { ...DETAIL, topics: ["duplicate", "duplicate"] },
    { ...DETAIL, pushed_at: "2024-01-01T00:00:00Z" },
  ])("rejects a private or inconsistent repository detail", async (payload) => {
    pool.intercept({ path: "/repos/octocat/repo", method: "GET" }).reply(200, payload, { headers: JSON_HEADERS });
    await expect(new GitHubClient({ dispatcher: agent }).getRepo("octocat", "repo")).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
    });
  });

  it("rejects a dot-only repository immediately", async () => {
    await expect(new GitHubClient({ dispatcher: agent }).getRepo("octocat", "...")).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
    });
    expect(agent.assertNoPendingInterceptors()).toBeUndefined();
  });

  it("maps nullable actors and validates activity navigation", async () => {
    pool
      .intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" })
      .reply(200, [{ ...ACTIVITY, actor: null }], {
        headers: {
          ...JSON_HEADERS,
          link: '<https://api.github.com/repositories/2/activity?direction=desc&per_page=20&after=next-value>; rel="next"',
        },
      });
    const result = await new GitHubClient({ dispatcher: agent }).listRepoActivity("octocat", "repo");
    expect(result.activities[0]).toMatchObject({ actor: null, actorAvatarUrl: null });
    expect(result.nextCursor).toBe("next-value");
  });

  it("parses quoted commas, unquoted rel tokens, multiple directions, and ignores anchored links", async () => {
    pool.intercept({ path: /after=current/, method: "GET" }).reply(200, [ACTIVITY], {
      headers: {
        ...JSON_HEADERS,
        link: [
          '<https://attacker.invalid/ignored>; rel="next"; anchor="https://example.test/a,b"',
          '<https://api.github.com/repos/octocat/repo/activity?direction=desc&per_page=20&after=next>; rel=next; title="a,b"',
          '<https://api.github.com/repos/octocat/repo/activity?direction=desc&per_page=20&before=previous>; rel="prev"',
        ].join(", "),
      },
    });
    await expect(
      new GitHubClient({ dispatcher: agent }).listRepoActivity("octocat", "repo", 20, {
        direction: "after",
        value: "current",
      }),
    ).resolves.toMatchObject({ nextCursor: "next", prevCursor: "previous" });
  });

  it.each([
    '<https://api.github.com/repos/octocat/repo/activity?direction=desc&per_page=20&before=previous>; rel="prev"',
    '<https://api.github.com/repos/octocat/repo/activity?direction=desc&per_page=20&after=>; rel="next"',
    '<https://api.github.com/repos/octocat/repo/activity?direction=desc&per_page=20&after=next&before=previous>; rel="next"',
    '<https://api.github.com/repos/octocat/repo/activity?direction=desc&per_page=20&after=next&page=2>; rel="next"',
    '<https://api.github.com/repos/octocat/repo/activity?direction=desc&per_page=20&after=next>; rel="next prev"',
    '<https://api.github.com/user/2/activity?direction=desc&per_page=20&after=next>; rel="next"',
    '<not a URL>; rel="next"',
    `<https://api.github.com/repos/octocat/repo/activity?direction=desc&per_page=20&after=${"a".repeat(2049)}>; rel="next"`,
  ])("rejects semantically invalid activity navigation", async (link) => {
    pool.intercept({ path: /\/repos\/octocat\/repo\/activity/, method: "GET" }).reply(200, [ACTIVITY], {
      headers: { ...JSON_HEADERS, link },
    });
    await expect(new GitHubClient({ dispatcher: agent }).listRepoActivity("octocat", "repo")).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
    });
  });

  it("reconstructs backward activity state and rejects a repeated provider value", async () => {
    pool.intercept({ path: /before=current/, method: "GET" }).reply(200, [ACTIVITY], {
      headers: {
        ...JSON_HEADERS,
        link: '<https://api.github.com/repos/octocat/repo/activity?direction=desc&per_page=20&before=current>; rel="prev"',
      },
    });
    await expect(
      new GitHubClient({ dispatcher: agent }).listRepoActivity("octocat", "repo", 20, {
        direction: "before",
        value: "current",
      }),
    ).rejects.toMatchObject({ code: GITHUB_ERROR_UPSTREAM });
  });

  it("maps languages and tags through their exact schemas", async () => {
    pool.intercept({ path: "/repos/octocat/repo/languages", method: "GET" }).reply(
      200,
      { TypeScript: 42 },
      {
        headers: JSON_HEADERS,
      },
    );
    pool.intercept({ path: /\/repos\/octocat\/repo\/tags/, method: "GET" }).reply(200, [TAG], {
      headers: JSON_HEADERS,
    });
    const client = new GitHubClient({ dispatcher: agent });
    await expect(client.listRepoLanguages("octocat", "repo")).resolves.toEqual({ TypeScript: 42 });
    await expect(client.listRepoTags("octocat", "repo")).resolves.toMatchObject({ items: [TAG] });
  });

  it("validates tag pagination and rejects an over-limit or empty page with next navigation", async () => {
    const next = '<https://api.github.com/repositories/2/tags?per_page=1&page=3>; rel="next"';
    const prev = '<https://api.github.com/repos/octocat/repo/tags?per_page=1&page=1>; rel="prev"';
    pool.intercept({ path: /page=2/, method: "GET" }).reply(200, [TAG], {
      headers: { ...JSON_HEADERS, link: `${next}, ${prev}` },
    });
    pool.intercept({ path: /per_page=1$/, method: "GET" }).reply(200, [TAG, { ...TAG, name: "v2" }], {
      headers: JSON_HEADERS,
    });
    pool.intercept({ path: /per_page=2$/, method: "GET" }).reply(200, [], {
      headers: {
        ...JSON_HEADERS,
        link: '<https://api.github.com/repos/octocat/repo/tags?per_page=2&page=2>; rel="next"',
      },
    });
    const client = new GitHubClient({ dispatcher: agent });
    await expect(client.listRepoTags("octocat", "repo", 1, 2)).resolves.toMatchObject({ nextPage: 3, prevPage: 1 });
    await expect(client.listRepoTags("octocat", "repo", 1)).rejects.toMatchObject({ code: GITHUB_ERROR_UPSTREAM });
    await expect(client.listRepoTags("octocat", "repo", 2)).rejects.toMatchObject({ code: GITHUB_ERROR_UPSTREAM });
  });

  it("rejects a tag page in the owner numeric namespace", async () => {
    pool.intercept({ path: /\/repos\/octocat\/repo\/tags/, method: "GET" }).reply(200, [TAG], {
      headers: {
        ...JSON_HEADERS,
        link: '<https://api.github.com/user/2/tags?per_page=1&page=2>; rel="next"',
      },
    });
    await expect(new GitHubClient({ dispatcher: agent }).listRepoTags("octocat", "repo", 1)).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
    });
  });

  it("rejects an empty repository page that advertises next navigation", async () => {
    pool.intercept({ path: /\/users\/octocat\/repos/, method: "GET" }).reply(200, [], {
      headers: {
        ...JSON_HEADERS,
        link: '<https://api.github.com/users/octocat/repos?type=owner&sort=full_name&direction=asc&per_page=20&page=2>; rel="next"',
      },
    });
    await expect(new GitHubClient({ dispatcher: agent }).listOwnerRepos("octocat")).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
    });
  });

  it("maps 404 and every 403 or 429 to the accepted public taxonomy without reading an error body", async () => {
    pool.intercept({ path: "/users/missing", method: "GET" }).reply(404, "private canary");
    pool.intercept({ path: "/users/limited", method: "GET" }).reply(403, "private canary", {
      headers: { "retry-after": "17", "x-ratelimit-reset": "200" },
    });
    const client = new GitHubClient({ dispatcher: agent, now: () => 100_000 });
    await expect(client.getOwner("missing")).rejects.toMatchObject({ code: GITHUB_ERROR_NOT_FOUND, statusCode: 404 });
    await expect(client.getOwner("limited")).rejects.toMatchObject({
      code: GITHUB_ERROR_RATE_LIMIT,
      statusCode: 429,
      retryAfter: "17",
      rateLimitReset: "200",
    });
  });

  it("uses a controlled quota fallback for malformed hints", async () => {
    pool.intercept({ path: "/users/limited", method: "GET" }).reply(429, "", {
      headers: { "retry-after": "1, 2", "x-ratelimit-reset": "01" },
    });
    await expect(new GitHubClient({ dispatcher: agent }).getOwner("limited")).rejects.toMatchObject({
      code: GITHUB_ERROR_RATE_LIMIT,
      retryAfter: "60",
      rateLimitReset: undefined,
    });
  });

  it("derives a ceiling delay from a usable reset and ignores quota fields on other statuses", async () => {
    pool.intercept({ path: "/users/limited", method: "GET" }).reply(429, "", {
      headers: { "x-ratelimit-reset": "102" },
    });
    pool.intercept({ path: "/users/missing", method: "GET" }).reply(404, "", {
      headers: { "retry-after": "3", "x-ratelimit-reset": "200" },
    });
    const client = new GitHubClient({ dispatcher: agent, now: () => 100_250 });
    await expect(client.getOwner("limited")).rejects.toMatchObject({ retryAfter: "2", rateLimitReset: "102" });
    await expect(client.getOwner("missing")).rejects.toMatchObject({
      code: GITHUB_ERROR_NOT_FOUND,
      retryAfter: undefined,
      rateLimitReset: undefined,
    });
  });

  it.each([201, 401, 410, 422, 500])("maps unexpected provider status %i to 502", async (statusCode) => {
    pool.intercept({ path: "/users/octocat", method: "GET" }).reply(statusCode, "private body canary", {
      headers: { "content-encoding": "identity" },
    });
    await expect(new GitHubClient({ dispatcher: agent }).getOwner("octocat")).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
      statusCode: 502,
    });
  });

  it("rejects missing, ambiguous, or fourth redirect locations", async () => {
    pool.intercept({ path: "/users/missing-location", method: "GET" }).reply(302, "");
    const client = new GitHubClient({ dispatcher: agent });
    await expect(client.getOwner("missing-location")).rejects.toMatchObject({ code: GITHUB_ERROR_UPSTREAM });

    pool.intercept({ path: "/users/a", method: "GET" }).reply(302, "", { headers: { location: "/user/1" } });
    pool.intercept({ path: "/user/1", method: "GET" }).reply(302, "", { headers: { location: "/user/2" } });
    pool.intercept({ path: "/user/2", method: "GET" }).reply(302, "", { headers: { location: "/user/3" } });
    pool.intercept({ path: "/user/3", method: "GET" }).reply(302, "", { headers: { location: "/user/4" } });
    await expect(client.getOwner("a")).rejects.toMatchObject({ code: GITHUB_ERROR_UPSTREAM });
  });

  it.each([
    { body: '{"login":"a","login":"b"}', headers: JSON_HEADERS },
    { body: OWNER, headers: { "content-type": "text/html" } },
    { body: OWNER, headers: { "content-type": "application/json;" } },
    { body: OWNER, headers: { "content-type": "application/json; charset" } },
    { body: OWNER, headers: { "content-type": "application/json; charset=utf-8; CHARSET=ascii" } },
    { body: OWNER, headers: { "content-type": 'application/json; note="unterminated' } },
    { body: OWNER, headers: { "content-type": "application/json, application/json" } },
    { body: OWNER, headers: { ...JSON_HEADERS, "content-encoding": "gzip" } },
    { body: OWNER, headers: { ...JSON_HEADERS, "content-length": "4194305" } },
  ])("rejects malformed, mislabeled, encoded, and oversized successes", async ({ body, headers }) => {
    pool.intercept({ path: "/users/octocat", method: "GET" }).reply(200, body, { headers });
    await expect(new GitHubClient({ dispatcher: agent }).getOwner("octocat")).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
      statusCode: 502,
    });
  });

  it("accepts syntactically valid JSON media parameters including quoted commas", async () => {
    pool.intercept({ path: "/users/octocat", method: "GET" }).reply(200, OWNER, {
      headers: { "content-type": 'application/vnd.github+json; charset="utf-8"; note="a,b"' },
    });
    await expect(new GitHubClient({ dispatcher: agent }).getOwner("octocat")).resolves.toMatchObject({ id: 1 });
  });

  it("rejects unsafe integer and timestamp projection values", async () => {
    pool.intercept({ path: "/users/octocat", method: "GET" }).reply(
      200,
      {
        ...OWNER,
        id: Number.MAX_SAFE_INTEGER + 1,
        created_at: "2024-01-01T00:00:00Z",
      },
      { headers: JSON_HEADERS },
    );
    await expect(new GitHubClient({ dispatcher: agent }).getOwner("octocat")).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
    });
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid timeout %s", (timeoutMs) => {
    expect(() => new GitHubClient({ timeoutMs })).toThrow(RangeError);
  });

  it("maps header and body deadlines to 504", async () => {
    pool.intercept({ path: "/users/octocat", method: "GET" }).reply(200, OWNER, { headers: JSON_HEADERS }).delay(100);
    await expect(new GitHubClient({ dispatcher: agent, timeoutMs: 10 }).getOwner("octocat")).rejects.toMatchObject({
      code: GITHUB_ERROR_TIMEOUT,
      statusCode: 504,
    });
    await expect(
      new GitHubClient({ dispatcher: new PartialBodyTimeoutDispatcher() }).getOwner("octocat"),
    ).rejects.toMatchObject({
      code: GITHUB_ERROR_TIMEOUT,
      statusCode: 504,
    });
  });

  it("preserves caller cancellation and maps transport failure without leaking it", async () => {
    pool.intercept({ path: "/users/octocat", method: "GET" }).reply(200, OWNER, { headers: JSON_HEADERS }).delay(100);
    const controller = new AbortController();
    const reason = new Error("caller cancellation");
    const pending = new GitHubClient({ dispatcher: agent, timeoutMs: 500 }).getOwner("octocat", controller.signal);
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
    await expect(new GitHubClient({ dispatcher: agent }).getOwner("unmocked")).rejects.toMatchObject({
      code: GITHUB_ERROR_UPSTREAM,
      statusCode: 502,
    });
  });
});
