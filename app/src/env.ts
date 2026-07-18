import Type from "typebox";
import Value from "typebox/value";

/**
 * Environment configuration schema with validation.
 *
 * This module provides centralized environment validation that runs
 * before Fastify instance creation, ensuring fail-fast behavior
 * for missing or invalid configuration.
 *
 * @example
 * ```typescript
 * import { env } from './env.js';
 *
 * const fastify = Fastify({
 *   loggerInstance: createObservabilityLogger({ level: env.LOG_LEVEL })
 * });
 * ```
 */
const EnvSchema = Type.Object({
  NODE_ENV: Type.Union([Type.Literal("development"), Type.Literal("production"), Type.Literal("test")], {
    default: "development",
  }),
  PORT: Type.Number({ default: 3000, minimum: 1, maximum: 65_535 }),
  HOST: Type.String({ default: "0.0.0.0", minLength: 1 }),
  LOG_LEVEL: Type.Union(
    [
      Type.Literal("trace"),
      Type.Literal("debug"),
      Type.Literal("info"),
      Type.Literal("warn"),
      Type.Literal("error"),
      Type.Literal("fatal"),
      Type.Literal("silent"),
    ],
    { default: "info" },
  ),
  CORS_ORIGINS: Type.String({
    default: "",
    description: "JSON array or comma-separated list of exact browser origins",
  }),
});

function parseOriginCandidates(value: string): unknown[] {
  if (value.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw new Error("CORS_ORIGINS must be a valid JSON array or comma-separated list", { cause: error });
    }
    if (!Array.isArray(parsed)) {
      throw new TypeError("CORS_ORIGINS JSON value must be an array");
    }
    return parsed;
  }
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeOrigin(candidate: unknown): string {
  if (typeof candidate !== "string") {
    throw new TypeError("CORS_ORIGINS entries must be strings");
  }

  const origin = candidate.trim();
  let url: URL;
  try {
    url = new URL(origin);
  } catch (error) {
    throw new Error(`Invalid CORS origin: ${origin}`, { cause: error });
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(`CORS origin must be an exact HTTP(S) origin: ${origin}`);
  }
  return url.origin;
}

export function parseCorsOrigins(raw: string): readonly string[] {
  const value = raw.trim();
  if (value === "") return [];

  return [...new Set(parseOriginCandidates(value).map(normalizeOrigin))];
}

const decodedEnv = Value.Decode(EnvSchema, {
  NODE_ENV: process.env["NODE_ENV"],
  PORT: process.env["PORT"],
  HOST: process.env["HOST"],
  LOG_LEVEL: process.env["LOG_LEVEL"],
  CORS_ORIGINS: process.env["CORS_ORIGINS"],
});

export const env = {
  ...decodedEnv,
  CORS_ORIGINS: parseCorsOrigins(decodedEnv.CORS_ORIGINS),
} as const;

export type Env = typeof env;
