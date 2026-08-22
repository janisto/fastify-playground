import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { PortableError } from "../utils/portable-error.js";
import { MAX_REQUEST_BODY_BYTES } from "./request-body.js";

const NO_QUERY = new Set<string>();
const PAGINATION_QUERY = new Set(["limit", "cursor"]);
const ITEM_QUERY = new Set(["limit", "cursor", "category"]);
const QUERY_POLICY = new Map<string, ReadonlySet<string>>([
  ["/health", NO_QUERY],
  ["/status", NO_QUERY],
  ["/openapi.json", NO_QUERY],
  ["/v1/auth/me", NO_QUERY],
  ["/v1/hello", NO_QUERY],
  ["/v1/items", ITEM_QUERY],
  ["/v1/profile", NO_QUERY],
  ["/v1/github/owners/:owner", NO_QUERY],
  ["/v1/github/owners/:owner/repos", PAGINATION_QUERY],
  ["/v1/github/repos/:owner/:repo", NO_QUERY],
  ["/v1/github/repos/:owner/:repo/activity", PAGINATION_QUERY],
  ["/v1/github/repos/:owner/:repo/languages", NO_QUERY],
  ["/v1/github/repos/:owner/:repo/tags", PAGINATION_QUERY],
]);

const BODY_METHODS = new Map<string, ReadonlySet<string>>([
  ["/v1/hello", new Set(["POST"])],
  ["/v1/profile", new Set(["POST", "PATCH"])],
]);
const BODY_MEMBERS = new Map<string, ReadonlySet<string>>([
  ["POST /v1/hello", new Set(["name"])],
  [
    "POST /v1/profile",
    new Set(["firstName", "lastName", "contactEmail", "phoneNumber", "marketingOptIn", "termsAccepted"]),
  ],
  ["PATCH /v1/profile", new Set(["firstName", "lastName", "contactEmail", "phoneNumber", "marketingOptIn"])],
]);

function rawHeaderValues(request: FastifyRequest, name: string): string[] {
  const values: string[] = [];
  const headers = request.raw.rawHeaders;
  for (let index = 0; index + 1 < headers.length; index += 2) {
    if (headers.at(index)?.toLowerCase() === name) {
      const value = headers.at(index + 1);
      if (value !== undefined) values.push(value);
    }
  }
  return values;
}

function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value.replaceAll("+", " "));
  } catch (error) {
    throw new PortableError("invalid_request", { cause: error });
  }
}

function validateQuery(request: FastifyRequest): void {
  const routeUrl = request.routeOptions.url;
  if (routeUrl === undefined) return;
  const policy = QUERY_POLICY.get(routeUrl);
  if (!policy) return;
  const rawTarget = request.raw.url ?? "";
  const question = rawTarget.indexOf("?");
  if (question < 0 || question === rawTarget.length - 1) return;

  const names = new Set<string>();
  for (const member of rawTarget.slice(question + 1).split("&")) {
    if (member.length === 0) continue;
    const separator = member.indexOf("=");
    const rawName = separator < 0 ? member : member.slice(0, separator);
    const rawValue = separator < 0 ? "" : member.slice(separator + 1);
    const name = decodeQueryComponent(rawName);
    const value = decodeQueryComponent(rawValue);
    if (!policy.has(name) || names.has(name)) throw new PortableError("invalid_request");
    if (name === "limit" && !/^[0-9]+$/.test(value)) throw new PortableError("validation_failed");
    if (name === "cursor" && (value.length === 0 || value.length > 2048 || !/^[!-~]+$/.test(value))) {
      throw new PortableError("invalid_request");
    }
    names.add(name);
  }
}

function decodeQuotedParameter(value: string): string | null {
  if (value.length < 2 || value[0] !== '"' || value.at(-1) !== '"') return null;
  let decoded = "";
  for (let index = 1; index < value.length - 1; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22 || (code !== 0x09 && (code < 0x20 || code === 0x7f))) return null;
    if (code === 0x5c) {
      index += 1;
      if (index >= value.length - 1) return null;
      const escaped = value.charCodeAt(index);
      if (escaped !== 0x09 && (escaped < 0x20 || escaped === 0x7f)) return null;
    }
    decoded += value[index];
  }
  return decoded;
}

function parseContentType(value: string): "application/json" | "application/cbor" | null {
  if (value.includes(",")) return null;
  const [rawMediaType, ...rawParameters] = value.split(";");
  const mediaType = rawMediaType?.trim().toLowerCase();
  if (mediaType === "application/cbor") return rawParameters.length === 0 ? mediaType : null;
  if (mediaType !== "application/json") return null;
  if (rawParameters.length === 0) return mediaType;
  if (rawParameters.length !== 1) return null;
  const parameter = rawParameters[0]?.trim() ?? "";
  const equals = parameter.indexOf("=");
  if (equals <= 0 || parameter.slice(0, equals).trim().toLowerCase() !== "charset") return null;
  const rawValue = parameter.slice(equals + 1).trim();
  const decoded = rawValue.startsWith('"') ? decodeQuotedParameter(rawValue) : rawValue;
  return decoded?.toLowerCase() === "utf-8" ? mediaType : null;
}

function validateBodyFields(request: FastifyRequest): void {
  const routeUrl = request.routeOptions.url;
  if (routeUrl === undefined) return;
  const methods = BODY_METHODS.get(routeUrl);
  if (!methods?.has(request.method)) return;

  const contentLengths = rawHeaderValues(request, "content-length");
  const declaredLength = contentLengths.length === 1 ? contentLengths[0] : undefined;
  if (declaredLength && /^[0-9]+$/.test(declaredLength) && BigInt(declaredLength) > BigInt(MAX_REQUEST_BODY_BYTES)) {
    throw new PortableError("payload_too_large");
  }

  const encodings = rawHeaderValues(request, "content-encoding");
  if (encodings.length > 1 || (encodings.length === 1 && encodings[0]?.trim().toLowerCase() !== "identity")) {
    throw new PortableError("unsupported_media_type");
  }

  const contentTypes = rawHeaderValues(request, "content-type");
  const contentLength = Number(request.headers["content-length"] ?? "0");
  if (contentTypes.length === 0) {
    if (contentLength > 0) throw new PortableError("unsupported_media_type");
    return;
  }
  if (contentTypes.length !== 1 || parseContentType(contentTypes[0] ?? "") === null) {
    throw new PortableError("unsupported_media_type");
  }
}

function validateBodyMembers(request: FastifyRequest): void {
  const routeUrl = request.routeOptions.url;
  if (routeUrl === undefined) return;
  const allowed = BODY_MEMBERS.get(`${request.method} ${routeUrl}`);
  if (!allowed || typeof request.body !== "object" || request.body === null || Array.isArray(request.body)) return;
  const members = Object.keys(request.body);
  if (members.some((member) => !allowed.has(member)) || (request.method === "PATCH" && members.length === 0)) {
    throw new PortableError("validation_failed");
  }
}

const portableHttpPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    validateQuery(request);
    validateBodyFields(request);
  });

  fastify.addHook("preValidation", async (request) => {
    const routeUrl = request.routeOptions.url;
    if (routeUrl === undefined) return;
    const methods = BODY_METHODS.get(routeUrl);
    if (methods?.has(request.method) && request.body === undefined) throw new PortableError("invalid_request");
    validateBodyMembers(request);
  });
};

export default fp(portableHttpPlugin, {
  fastify: "5.x",
  name: "@app/portable-http",
});
