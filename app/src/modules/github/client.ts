import { Buffer } from "node:buffer";
import type { StaticDecode, TSchema } from "typebox";
import Value from "typebox/value";
import { type Dispatcher, request as undiciRequest } from "undici";
import { parseStrictJson } from "../../utils/strict-json.js";
import {
  GITHUB_ERROR_NOT_FOUND,
  GITHUB_ERROR_RATE_LIMIT,
  GITHUB_ERROR_TIMEOUT,
  GITHUB_ERROR_UPSTREAM,
  GitHubApiError,
} from "./errors.js";
import type { GitHubActivity, GitHubOwner, GitHubRepo, GitHubRepoDetail, GitHubTag } from "./schemas.js";
import {
  type RawGitHubActivity,
  RawGitHubActivityListSchema,
  RawGitHubLanguagesSchema,
  type RawGitHubOwner,
  RawGitHubOwnerReposSchema,
  RawGitHubOwnerSchema,
  type RawGitHubRepo,
  type RawGitHubRepoDetail,
  RawGitHubRepoDetailSchema,
  RawGitHubTagsSchema,
} from "./upstream-schemas.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 4_194_304;
const SAFE_INTEGER_MAXIMUM = 9_007_199_254_740_991;
const GITHUB_API_VERSION = "2026-03-10";
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const CANONICAL_DECIMAL = /^(?:0|[1-9][0-9]*)$/;
const JSON_NUMBER_COMPONENTS = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/;
const HTTP_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export interface GitHubClientOptions {
  baseUrl?: string;
  /** Explicit credential for isolated opt-in direct-client smoke tests only. */
  token?: string;
  dispatcher?: Dispatcher;
  timeoutMs?: number;
  now?: () => number;
}

type ResponseHeaders = Record<string, string | string[] | undefined>;
type RequestResult = Dispatcher.ResponseData & { timeoutSignal: AbortSignal };

export interface ActivityPage {
  activities: GitHubActivity[];
  nextCursor: string | null;
  prevCursor: string | null;
}

export interface NumberedPage<T> {
  items: T[];
  nextPage: number | null;
  prevPage: number | null;
}

export interface ActivityCursor {
  direction: "after" | "before";
  value: string;
}

interface NumberedLinkContext {
  readonly currentPage: number;
  readonly expectedPath: string;
  readonly fixedQuery: Readonly<Record<string, string>>;
  readonly limit: number;
  readonly numericSuffix: "/repos" | "/tags";
}

interface ActivityLinkContext {
  readonly currentCursor?: ActivityCursor;
  readonly expectedPath: string;
  readonly limit: number;
}

type NumberPathPolicy = (path: readonly (string | number)[]) => boolean;

const OWNER_NUMBER_FIELDS = new Set(["id", "public_repos", "followers", "following"]);
const REPOSITORY_NUMBER_FIELDS = new Set(["id", "stargazers_count", "forks_count", "open_issues_count"]);

function topLevelNumberPath(fields: ReadonlySet<string>): NumberPathPolicy {
  return (path) => path.length === 1 && typeof path[0] === "string" && fields.has(path[0]);
}

const OWNER_NUMBER_PATH = topLevelNumberPath(OWNER_NUMBER_FIELDS);
const REPOSITORY_NUMBER_PATH = topLevelNumberPath(REPOSITORY_NUMBER_FIELDS);
const COLLECTION_ID_NUMBER_PATH: NumberPathPolicy = (path) =>
  path.length === 2 && typeof path[0] === "number" && path[1] === "id";
const LANGUAGE_BYTES_NUMBER_PATH: NumberPathPolicy = (path) => path.length === 1 && typeof path[0] === "string";

function headerValues(headers: ResponseHeaders, name: string): string[] {
  const value = headers[name];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function oneHeader(headers: ResponseHeaders, name: string): string | undefined {
  const values = headerValues(headers, name);
  return values.length === 1 ? values[0] : undefined;
}

function canonicalSafeInteger(value: string): number | null {
  if (!CANONICAL_DECIMAL.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= SAFE_INTEGER_MAXIMUM ? number : null;
}

function isExactSafeIntegerJsonNumber(source: string): boolean {
  const match = JSON_NUMBER_COMPONENTS.exec(source);
  if (!match) return false;
  const fraction = match[3] ?? "";
  const coefficient = `${match[2] ?? ""}${fraction}`.replace(/^0+/, "");
  if (coefficient.length === 0) return true;
  if (match[1] === "-") return false;

  const exponent = Number(match[4] ?? "0");
  let integer: string;
  if (exponent >= fraction.length) {
    const trailingZeros = exponent - fraction.length;
    if (coefficient.length + trailingZeros > String(SAFE_INTEGER_MAXIMUM).length) return false;
    integer = `${coefficient}${"0".repeat(trailingZeros)}`;
  } else {
    const removedDigits = fraction.length - exponent;
    if (removedDigits >= coefficient.length || !/^0+$/.test(coefficient.slice(-removedDigits))) return false;
    integer = coefficient.slice(0, -removedDigits);
  }

  const maximum = String(SAFE_INTEGER_MAXIMUM);
  return integer.length < maximum.length || (integer.length === maximum.length && integer <= maximum);
}

function splitMediaType(value: string): string[] | null {
  const parts: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
    } else if (quoted && character === "\\") {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ",") {
      return null;
    } else if (!quoted && character === ";") {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  if (quoted || escaped) return null;
  parts.push(value.slice(start));
  return parts;
}

function validQuotedString(value: string): boolean {
  if (value.length < 2 || value[0] !== '"' || value.at(-1) !== '"') return false;
  for (let index = 1; index < value.length - 1; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x5c) {
      index += 1;
      if (index >= value.length - 1) return false;
      const escaped = value.charCodeAt(index);
      if (escaped !== 0x09 && (escaped < 0x20 || escaped === 0x7f)) return false;
    } else if (code !== 0x09 && (code < 0x20 || code === 0x22 || code === 0x7f)) {
      return false;
    }
  }
  return true;
}

function decodedQuotedString(value: string): string | null {
  if (!validQuotedString(value)) return null;
  let decoded = "";
  for (let index = 1; index < value.length - 1; index += 1) {
    if (value.at(index) === "\\") index += 1;
    decoded += value.at(index) ?? "";
  }
  return decoded;
}

function linkParameterName(value: string): string {
  const equals = value.indexOf("=");
  return (equals < 0 ? value : value.slice(0, equals)).trim().toLowerCase();
}

function validJsonMediaType(value: string): boolean {
  const parts = splitMediaType(value);
  if (!parts || parts.length === 0) return false;
  const mediaType = parts[0]?.trim().toLowerCase() ?? "";
  const slash = mediaType.indexOf("/");
  if (slash <= 0 || mediaType.indexOf("/", slash + 1) >= 0) return false;
  const type = mediaType.slice(0, slash);
  const subtype = mediaType.slice(slash + 1);
  if (!HTTP_TOKEN.test(type) || !HTTP_TOKEN.test(subtype)) return false;
  if (mediaType !== "application/json" && !(type === "application" && subtype.endsWith("+json"))) return false;

  const names = new Set<string>();
  for (const rawParameter of parts.slice(1)) {
    const parameter = rawParameter.trim();
    const equals = parameter.indexOf("=");
    if (equals <= 0) return false;
    const name = parameter.slice(0, equals).trim().toLowerCase();
    const parameterValue = parameter.slice(equals + 1).trim();
    if (!HTTP_TOKEN.test(name) || names.has(name)) return false;
    if (!HTTP_TOKEN.test(parameterValue) && !validQuotedString(parameterValue)) return false;
    names.add(name);
  }
  return true;
}

function hasErrorCode(error: unknown, ...codes: string[]): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    codes.includes(error.code)
  );
}

function hasUndiciErrorCode(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("UND_ERR_")
  );
}

function canonicalGitHubTimestamp(value: string): string {
  const fractionStart = value.indexOf(".");
  if (fractionStart < 0) return `${value.slice(0, -1)}.000Z`;
  const fraction = value.slice(fractionStart + 1, -1);
  return `${value.slice(0, fractionStart)}.${fraction.padEnd(3, "0").slice(0, 3)}Z`;
}

function scalarCompare(left: string, right: string): number {
  const leftScalars = Array.from(left, (value) => value.codePointAt(0) ?? 0);
  const rightScalars = Array.from(right, (value) => value.codePointAt(0) ?? 0);
  const length = Math.min(leftScalars.length, rightScalars.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftScalars.at(index) ?? 0) - (rightScalars.at(index) ?? 0);
    if (difference !== 0) return difference;
  }
  return leftScalars.length - rightScalars.length;
}

function splitLinkHeader(value: string): string[] {
  const result: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  let angle = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.at(index);
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "<") angle = true;
    else if (character === ">") angle = false;
    else if (character === "," && !angle) {
      result.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(value.slice(start).trim());
  return result.filter(Boolean);
}

function splitLinkParameters(value: string): string[] | null {
  const result: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  let angle = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.at(index);
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "<") angle = true;
    else if (character === ">") angle = false;
    else if (character === ";" && !angle) {
      result.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (quoted || escaped || angle) return null;
  result.push(value.slice(start).trim());
  return result;
}

type LinkRelation = "next" | "prev";

interface RelevantLinkValue {
  readonly relations: LinkRelation[];
  readonly target: string;
}

function linkRelations(parameters: readonly string[]): string[] {
  const relations: string[] = [];
  for (const parameter of parameters) {
    const equals = parameter.indexOf("=");
    if (linkParameterName(parameter) !== "rel") continue;
    const rawRelation = equals < 0 ? "" : parameter.slice(equals + 1).trim();
    const relationValue = HTTP_TOKEN.test(rawRelation) ? rawRelation : decodedQuotedString(rawRelation);
    if (relationValue === null || !relationValue) throw new TypeError("malformed pagination relation");
    relations.push(...relationValue.split(/\s+/));
  }
  return relations;
}

function parseRelevantLinkValue(value: string): RelevantLinkValue | null {
  const parameters = splitLinkParameters(value);
  if (parameters === null) {
    if (/(?:^|;)\s*rel\s*=/i.test(value)) throw new TypeError("malformed pagination relation");
    return null;
  }
  const rawParameters = parameters.slice(1);
  if (rawParameters.some((parameter) => linkParameterName(parameter) === "anchor")) return null;

  const relevant: LinkRelation[] = [];
  for (const relation of linkRelations(rawParameters)) {
    const normalized = relation.toLowerCase();
    if (normalized === "next" || normalized === "prev") relevant.push(normalized);
  }
  if (relevant.length === 0) return null;
  const target = /^<([^>]*)>$/.exec(parameters[0] ?? "")?.[1];
  if (target === undefined || new Set(relevant).size !== relevant.length) {
    throw new TypeError("malformed or repeated pagination relation");
  }
  return { relations: relevant, target };
}

function queryEntries(url: URL): [string, string][] {
  return [...url.searchParams.entries()].toSorted(([leftName, leftValue], [rightName, rightValue]) => {
    const nameOrder = scalarCompare(leftName, rightName);
    return nameOrder === 0 ? scalarCompare(leftValue, rightValue) : nameOrder;
  });
}

function sameQuery(left: URL, right: URL): boolean {
  return JSON.stringify(queryEntries(left)) === JSON.stringify(queryEntries(right));
}

export class GitHubClient {
  private readonly baseOrigin: string;
  private readonly baseUrl: string;
  private readonly dispatcher: Dispatcher | undefined;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly token: string | undefined;

  constructor(options?: GitHubClientOptions) {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError("GitHub request timeout must be a positive safe integer");
    }
    const baseUrl = new URL(options?.baseUrl ?? "https://api.github.com");
    this.baseOrigin = baseUrl.origin;
    this.baseUrl = baseUrl.href.replace(/\/$/, "");
    this.dispatcher = options?.dispatcher;
    this.timeoutMs = timeoutMs;
    this.token = options?.token;
    this.now = options?.now ?? Date.now;
  }

  async getOwner(owner: string, signal?: AbortSignal): Promise<GitHubOwner> {
    const url = new URL(`${this.baseUrl}/users/${encodeURIComponent(owner)}`);
    const { data } = await this.getJson(url, RawGitHubOwnerSchema, signal, OWNER_NUMBER_PATH);
    return this.toGitHubOwner(data);
  }

  async listOwnerRepos(owner: string, limit = 20, page = 1, signal?: AbortSignal): Promise<NumberedPage<GitHubRepo>> {
    const url = new URL(`${this.baseUrl}/users/${encodeURIComponent(owner)}/repos`);
    url.searchParams.set("type", "owner");
    url.searchParams.set("sort", "full_name");
    url.searchParams.set("direction", "asc");
    url.searchParams.set("per_page", String(limit));
    if (page !== 1) url.searchParams.set("page", String(page));
    const { data, headers } = await this.getJson(url, RawGitHubOwnerReposSchema, signal, COLLECTION_ID_NUMBER_PATH);
    if (data.length > limit) throw this.invalidResponse("GitHub repository page exceeded the requested limit");
    const links = this.numberedLinks(headers, {
      currentPage: page,
      expectedPath: url.pathname,
      fixedQuery: { type: "owner", sort: "full_name", direction: "asc" },
      limit,
      numericSuffix: "/repos",
    });
    if (data.length === 0 && links.nextPage !== null) throw this.invalidResponse("empty page advertised next");
    return { items: data.map((repo) => this.toGitHubRepo(repo)), ...links };
  }

  async getRepo(owner: string, repo: string, signal?: AbortSignal): Promise<GitHubRepoDetail> {
    if (/^\.+$/.test(repo)) throw this.invalidResponse("dot-only repository reached URL construction");
    const url = new URL(`${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const { data } = await this.getJson(url, RawGitHubRepoDetailSchema, signal, REPOSITORY_NUMBER_PATH);
    return this.toGitHubRepoDetail(data);
  }

  async listRepoActivity(
    owner: string,
    repo: string,
    limit = 20,
    cursor?: ActivityCursor,
    signal?: AbortSignal,
  ): Promise<ActivityPage> {
    if (/^\.+$/.test(repo)) throw this.invalidResponse("dot-only repository reached URL construction");
    const url = new URL(`${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/activity`);
    url.searchParams.set("direction", "desc");
    url.searchParams.set("per_page", String(limit));
    if (cursor) url.searchParams.set(cursor.direction, cursor.value);
    const { data, headers } = await this.getJson(url, RawGitHubActivityListSchema, signal, COLLECTION_ID_NUMBER_PATH);
    if (data.length > limit) throw this.invalidResponse("GitHub activity page exceeded the requested limit");
    const links = this.activityLinks(headers, {
      expectedPath: url.pathname,
      limit,
      ...(cursor ? { currentCursor: cursor } : {}),
    });
    if (data.length === 0 && links.nextCursor !== null) throw this.invalidResponse("empty page advertised next");
    return { activities: data.map((activity) => this.toGitHubActivity(activity)), ...links };
  }

  async listRepoLanguages(owner: string, repo: string, signal?: AbortSignal): Promise<Record<string, number>> {
    if (/^\.+$/.test(repo)) throw this.invalidResponse("dot-only repository reached URL construction");
    const url = new URL(`${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`);
    const data = (await this.getJson(url, RawGitHubLanguagesSchema, signal, LANGUAGE_BYTES_NUMBER_PATH)).data;
    if (Object.keys(data).some((name) => name.length === 0)) {
      throw this.invalidResponse("GitHub language name was empty");
    }
    return data;
  }

  async listRepoTags(
    owner: string,
    repo: string,
    limit = 20,
    page = 1,
    signal?: AbortSignal,
  ): Promise<NumberedPage<GitHubTag>> {
    if (/^\.+$/.test(repo)) throw this.invalidResponse("dot-only repository reached URL construction");
    const url = new URL(`${this.baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags`);
    url.searchParams.set("per_page", String(limit));
    if (page !== 1) url.searchParams.set("page", String(page));
    const { data, headers } = await this.getJson(url, RawGitHubTagsSchema, signal);
    if (data.length > limit) throw this.invalidResponse("GitHub tag page exceeded the requested limit");
    const links = this.numberedLinks(headers, {
      currentPage: page,
      expectedPath: url.pathname,
      fixedQuery: {},
      limit,
      numericSuffix: "/tags",
    });
    if (data.length === 0 && links.nextPage !== null) throw this.invalidResponse("empty page advertised next");
    return {
      items: data.map((tag) => ({ name: tag.name, commit: { sha: tag.commit.sha } })),
      ...links,
    };
  }

  private buildHeaders(): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": "fastify-playground",
      "Accept-Encoding": "identity",
      ...(this.token === undefined ? {} : { Authorization: `Bearer ${this.token}` }),
    };
  }

  private buildRequestOptions(signal: AbortSignal) {
    return {
      method: "GET",
      idempotent: false,
      headers: this.buildHeaders(),
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
      signal,
      maxRedirections: 0,
      ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
    };
  }

  private async getJson<const Schema extends TSchema>(
    url: URL,
    schema: Schema,
    callerSignal?: AbortSignal,
    exactNumberPath?: NumberPathPolicy,
  ): Promise<{ data: StaticDecode<Schema>; headers: ResponseHeaders }> {
    const { statusCode, headers, body, timeoutSignal } = await this.request(url, callerSignal);
    if (statusCode !== 200) {
      await this.discardBody(body, callerSignal, timeoutSignal);
      throw this.mapError(statusCode, headers);
    }
    await this.validateContentType(headers, body, callerSignal, timeoutSignal);
    const bytes = await this.readBoundedBody(body, headers, callerSignal, timeoutSignal);
    let value: unknown;
    try {
      value = parseStrictJson(bytes, {
        validateNumber: (source, _number, path) => {
          if (exactNumberPath?.(path) && !isExactSafeIntegerJsonNumber(source)) {
            throw new SyntaxError("GitHub number is not an exact safe integer");
          }
        },
      });
      Value.Assert(schema, value);
      return { data: Value.Decode(schema, value), headers };
    } catch (error) {
      if (callerSignal?.aborted || timeoutSignal.aborted || hasUndiciErrorCode(error)) {
        this.throwRequestFailure(error, callerSignal, timeoutSignal);
      }
      throw this.invalidResponse("GitHub success body was invalid");
    }
  }

  private async request(url: URL, callerSignal?: AbortSignal): Promise<RequestResult> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;
    const response = await this.requestWithRedirects(url, url, signal, callerSignal, timeoutSignal, new Set(), 0);
    return { ...response, timeoutSignal };
  }

  private async requestWithRedirects(
    initialUrl: URL,
    currentUrl: URL,
    signal: AbortSignal,
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
    visited: Set<string>,
    redirectCount: number,
  ): Promise<Dispatcher.ResponseData> {
    if (visited.has(currentUrl.href)) throw this.invalidResponse("GitHub redirect loop");
    visited.add(currentUrl.href);
    let response: Dispatcher.ResponseData;
    try {
      response = await undiciRequest(currentUrl, this.buildRequestOptions(signal));
    } catch (error) {
      this.throwRequestFailure(error, callerSignal, timeoutSignal);
    }
    await this.validateContentEncoding(response.headers, response.body, callerSignal, timeoutSignal);
    if (!REDIRECT_STATUS_CODES.has(response.statusCode)) return response;
    await this.discardBody(response.body, callerSignal, timeoutSignal);
    if (redirectCount >= MAX_REDIRECTS) throw this.invalidResponse("GitHub redirect limit exceeded");
    const locations = headerValues(response.headers, "location");
    if (locations.length !== 1) throw this.invalidResponse("GitHub redirect Location was missing or ambiguous");
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(locations[0] ?? "", currentUrl);
    } catch (error) {
      throw this.invalidResponse("GitHub redirect Location was invalid", error);
    }
    this.validateRedirectTarget(initialUrl, redirectUrl);
    return this.requestWithRedirects(
      initialUrl,
      redirectUrl,
      signal,
      callerSignal,
      timeoutSignal,
      visited,
      redirectCount + 1,
    );
  }

  private validateRedirectTarget(initialUrl: URL, target: URL): void {
    if (target.origin !== this.baseOrigin || target.username || target.password || target.hash) {
      throw this.invalidResponse("GitHub redirect escaped the trusted origin");
    }
    const suffix = initialUrl.pathname.endsWith("/activity")
      ? "/activity"
      : initialUrl.pathname.endsWith("/languages")
        ? "/languages"
        : initialUrl.pathname.endsWith("/tags")
          ? "/tags"
          : initialUrl.pathname.endsWith("/repos")
            ? "/repos"
            : "";
    const numericPrefix = initialUrl.pathname.startsWith("/users/") ? "/user/" : "/repositories/";
    const numericPattern = new RegExp(`^${numericPrefix}([0-9]+)${suffix}$`);
    const numericMatch = numericPattern.exec(target.pathname);
    if (target.pathname !== initialUrl.pathname) {
      const numericId = numericMatch?.[1] === undefined ? null : canonicalSafeInteger(numericMatch[1]);
      if (numericId === null) throw this.invalidResponse("GitHub redirect path was not allowlisted");
    }
    if (!sameQuery(initialUrl, target)) throw this.invalidResponse("GitHub redirect query changed");
  }

  private async validateContentEncoding(
    headers: ResponseHeaders,
    body: Dispatcher.ResponseData["body"],
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): Promise<void> {
    const values = headerValues(headers, "content-encoding");
    if (values.length > 1 || (values.length === 1 && values[0]?.trim().toLowerCase() !== "identity")) {
      await this.discardBody(body, callerSignal, timeoutSignal);
      throw this.invalidResponse("GitHub response used unsupported content encoding");
    }
  }

  private async validateContentType(
    headers: ResponseHeaders,
    body: Dispatcher.ResponseData["body"],
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): Promise<void> {
    const values = headerValues(headers, "content-type");
    if (values.length !== 1) {
      await this.discardBody(body, callerSignal, timeoutSignal);
      throw this.invalidResponse("GitHub response omitted or repeated Content-Type");
    }
    const value = values[0] ?? "";
    if (!validJsonMediaType(value)) {
      await this.discardBody(body, callerSignal, timeoutSignal);
      throw this.invalidResponse("GitHub response was not JSON");
    }
  }

  private async readBoundedBody(
    body: Dispatcher.ResponseData["body"],
    headers: ResponseHeaders,
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): Promise<Buffer> {
    const declared = oneHeader(headers, "content-length");
    if (declared !== undefined) {
      const size = canonicalSafeInteger(declared);
      if (size !== null && size > MAX_RESPONSE_BYTES) {
        await this.discardBody(body, callerSignal, timeoutSignal);
        throw this.invalidResponse("GitHub response exceeded the body limit");
      }
    }
    const chunks: Buffer[] = [];
    let length = 0;
    try {
      for await (const chunk of body) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        length += bytes.length;
        if (length > MAX_RESPONSE_BYTES) {
          body.destroy();
          throw this.invalidResponse("GitHub response exceeded the body limit");
        }
        chunks.push(bytes);
      }
    } catch (error) {
      if (error instanceof GitHubApiError) throw error;
      this.throwRequestFailure(error, callerSignal, timeoutSignal);
    }
    return Buffer.concat(chunks, length);
  }

  private async discardBody(
    body: Dispatcher.ResponseData["body"],
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): Promise<void> {
    try {
      await body.dump();
    } catch (error) {
      this.throwRequestFailure(error, callerSignal, timeoutSignal);
    }
  }

  private throwRequestFailure(
    error: unknown,
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): never {
    if (callerSignal?.aborted) throw callerSignal.reason instanceof Error ? callerSignal.reason : error;
    if (
      timeoutSignal.aborted ||
      hasErrorCode(error, "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_CONNECT_TIMEOUT")
    ) {
      throw new GitHubApiError("GitHub request timed out", 504, GITHUB_ERROR_TIMEOUT, undefined, { cause: error });
    }
    throw new GitHubApiError("GitHub request failed", 502, GITHUB_ERROR_UPSTREAM, undefined, { cause: error });
  }

  private mapError(statusCode: number, headers: ResponseHeaders): GitHubApiError {
    if (statusCode === 404) return new GitHubApiError("GitHub resource not found", 404, GITHUB_ERROR_NOT_FOUND);
    if (statusCode === 403 || statusCode === 429) {
      const nowSeconds = this.now() / 1000;
      const reset = this.usableReset(headers, nowSeconds);
      const retryAfter = this.quotaDelay(headers, nowSeconds, reset);
      return new GitHubApiError(
        "GitHub rate limit exceeded",
        429,
        GITHUB_ERROR_RATE_LIMIT,
        retryAfter,
        undefined,
        reset,
      );
    }
    return new GitHubApiError("GitHub upstream response is invalid", 502, GITHUB_ERROR_UPSTREAM);
  }

  private canonicalQuotaValue(headers: ResponseHeaders, name: string): number | null {
    const values = headerValues(headers, name);
    if (values.length !== 1 || values[0]?.includes(",") === true) return null;
    return canonicalSafeInteger(values[0] ?? "");
  }

  private usableReset(headers: ResponseHeaders, nowSeconds: number): string | undefined {
    const reset = this.canonicalQuotaValue(headers, "x-ratelimit-reset");
    return reset !== null && reset > nowSeconds ? String(reset) : undefined;
  }

  private quotaDelay(headers: ResponseHeaders, nowSeconds: number, reset: string | undefined): string {
    const retry = this.canonicalQuotaValue(headers, "retry-after");
    if (retry !== null) return String(retry);
    if (reset !== undefined) return String(Math.max(1, Math.ceil(Number(reset) - nowSeconds)));
    return "60";
  }

  private numberedLinks(
    headers: ResponseHeaders,
    context: NumberedLinkContext,
  ): { nextPage: number | null; prevPage: number | null } {
    const relations = this.relevantLinks(headers);
    const read = (relation: "next" | "prev"): number | null => {
      const target = relations.get(relation);
      if (!target) return null;
      this.validateLinkOrigin(target);
      if (!this.allowedNumericPath(target.pathname, context.expectedPath, context.numericSuffix)) {
        throw this.invalidResponse("GitHub pagination path was invalid");
      }
      const expected = new Map(Object.entries(context.fixedQuery));
      expected.set("per_page", String(context.limit));
      const pageValues = target.searchParams.getAll("page");
      if (pageValues.length !== 1) throw this.invalidResponse("GitHub pagination page was missing or repeated");
      const page = canonicalSafeInteger(pageValues[0] ?? "");
      if (page === null || page < 1) throw this.invalidResponse("GitHub pagination page was invalid");
      target.searchParams.delete("page");
      if (!this.exactQuery(target, expected)) throw this.invalidResponse("GitHub pagination query was invalid");
      if (
        (relation === "next" && page <= context.currentPage) ||
        (relation === "prev" && page >= context.currentPage)
      ) {
        throw this.invalidResponse("GitHub pagination did not progress");
      }
      return page;
    };
    return { nextPage: read("next"), prevPage: read("prev") };
  }

  private activityLinks(
    headers: ResponseHeaders,
    context: ActivityLinkContext,
  ): { nextCursor: string | null; prevCursor: string | null } {
    const relations = this.relevantLinks(headers);
    const read = (relation: "next" | "prev"): string | null => {
      const target = relations.get(relation);
      if (!target) return null;
      if (relation === "prev" && context.currentCursor === undefined) {
        throw this.invalidResponse("initial activity page advertised previous navigation");
      }
      this.validateLinkOrigin(target);
      if (!this.allowedNumericPath(target.pathname, context.expectedPath, "/activity")) {
        throw this.invalidResponse("GitHub activity pagination path was invalid");
      }
      const parameter = relation === "next" ? "after" : "before";
      const values = target.searchParams.getAll(parameter);
      const opposite = relation === "next" ? "before" : "after";
      if (values.length !== 1 || target.searchParams.has(opposite)) {
        throw this.invalidResponse("GitHub activity pagination direction was invalid");
      }
      const value = values[0] ?? "";
      if (value.length === 0 || value.length > 2048 || !/^[!-~]+$/.test(value)) {
        throw this.invalidResponse("GitHub activity cursor was invalid");
      }
      target.searchParams.delete(parameter);
      if (
        !this.exactQuery(
          target,
          new Map([
            ["direction", "desc"],
            ["per_page", String(context.limit)],
          ]),
        )
      ) {
        throw this.invalidResponse("GitHub activity pagination query was invalid");
      }
      if (context.currentCursor?.direction === parameter && context.currentCursor.value === value) {
        throw this.invalidResponse("GitHub activity pagination repeated the current cursor");
      }
      return value;
    };
    return { nextCursor: read("next"), prevCursor: read("prev") };
  }

  private relevantLinks(headers: ResponseHeaders): Map<LinkRelation, URL> {
    const result = new Map<LinkRelation, URL>();
    for (const field of headerValues(headers, "link")) {
      for (const value of splitLinkHeader(field)) {
        let parsed: RelevantLinkValue | null;
        try {
          parsed = parseRelevantLinkValue(value);
        } catch (error) {
          throw this.invalidResponse("GitHub pagination relation was malformed", error);
        }
        if (parsed === null) continue;
        if (parsed.relations.some((relation) => result.has(relation))) {
          throw this.invalidResponse("GitHub pagination relation was repeated");
        }
        let target: URL;
        try {
          target = new URL(parsed.target);
        } catch (error) {
          throw this.invalidResponse("GitHub pagination target was invalid", error);
        }
        for (const relation of parsed.relations) result.set(relation, target);
      }
    }
    return result;
  }

  private validateLinkOrigin(url: URL): void {
    if (url.origin !== this.baseOrigin || url.username || url.password || url.hash) {
      throw this.invalidResponse("GitHub pagination target escaped the trusted origin");
    }
  }

  private allowedNumericPath(path: string, namedPath: string, suffix: string): boolean {
    if (path === namedPath) return true;
    const prefix = suffix === "/repos" ? "/user/" : "/repositories/";
    const match = new RegExp(`^${prefix}([0-9]+)${suffix}$`).exec(path);
    return match?.[1] !== undefined && canonicalSafeInteger(match[1]) !== null;
  }

  private exactQuery(url: URL, expected: ReadonlyMap<string, string>): boolean {
    if ([...url.searchParams.keys()].length !== expected.size) return false;
    return [...expected].every(([name, value]) => {
      const values = url.searchParams.getAll(name);
      return values.length === 1 && values[0] === value;
    });
  }

  private invalidResponse(reason: string, cause?: unknown): GitHubApiError {
    return new GitHubApiError("GitHub upstream response is invalid", 502, GITHUB_ERROR_UPSTREAM, undefined, {
      cause: cause ?? new TypeError(reason),
    });
  }

  private toGitHubOwner(raw: RawGitHubOwner): GitHubOwner {
    const display = (value: string | null | undefined): string | null => (value ? value : null);
    return {
      id: raw.id,
      login: raw.login,
      type: raw.type,
      name: display(raw.name),
      avatarUrl: raw.avatar_url,
      htmlUrl: raw.html_url,
      company: display(raw.company),
      blog: display(raw.blog),
      location: display(raw.location),
      bio: display(raw.bio),
      publicRepos: raw.public_repos,
      followers: raw.followers,
      following: raw.following,
      createdAt: canonicalGitHubTimestamp(raw.created_at),
      updatedAt: canonicalGitHubTimestamp(raw.updated_at),
    };
  }

  private toGitHubRepo(raw: RawGitHubRepo): GitHubRepo {
    return {
      id: raw.id,
      name: raw.name,
      fullName: raw.full_name,
      description: raw.description ? raw.description : null,
      htmlUrl: raw.html_url,
      fork: raw.fork,
    };
  }

  private toGitHubRepoDetail(raw: RawGitHubRepoDetail): GitHubRepoDetail {
    const license = raw.license?.spdx_id;
    return {
      ...this.toGitHubRepo(raw),
      language: raw.language,
      stargazersCount: raw.stargazers_count,
      forksCount: raw.forks_count,
      openIssuesCount: raw.open_issues_count,
      archived: raw.archived,
      createdAt: canonicalGitHubTimestamp(raw.created_at),
      updatedAt: canonicalGitHubTimestamp(raw.updated_at),
      pushedAt: raw.pushed_at === null ? null : canonicalGitHubTimestamp(raw.pushed_at),
      defaultBranch: raw.default_branch,
      license: !license || license === "NOASSERTION" ? null : license,
      topics: (raw.topics ?? []).toSorted(scalarCompare),
      disabled: raw.disabled,
    };
  }

  private toGitHubActivity(raw: RawGitHubActivity): GitHubActivity {
    return {
      id: raw.id,
      actor: raw.actor?.login ?? null,
      actorAvatarUrl: raw.actor?.avatar_url ?? null,
      ref: raw.ref,
      timestamp: canonicalGitHubTimestamp(raw.timestamp),
      activityType: raw.activity_type,
    };
  }
}

export { scalarCompare };
