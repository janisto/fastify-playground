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
 *   logger: { level: env.LOG_LEVEL }
 * });
 * ```
 */
const EnvSchema = Type.Object({
  NODE_ENV: Type.Union([Type.Literal("development"), Type.Literal("production"), Type.Literal("test")], {
    default: "development",
  }),
  PORT: Type.Number({ default: 3000 }),
  HOST: Type.String({ default: "0.0.0.0" }),
  LOG_LEVEL: Type.Union(
    [
      Type.Literal("trace"),
      Type.Literal("debug"),
      Type.Literal("info"),
      Type.Literal("warn"),
      Type.Literal("error"),
      Type.Literal("fatal"),
    ],
    { default: "info" },
  ),
  GOOGLE_CLOUD_PROJECT: Type.Optional(Type.String({ description: "Google Cloud Project ID for Cloud Trace" })),
  FIREBASE_PROJECT_ID: Type.Optional(
    Type.String({ description: "Firebase Project ID (primary source for Cloud Trace correlation)" }),
  ),
  FIREBASE_PROJECT_NUMBER: Type.Optional(Type.String({ description: "Firebase Project Number" })),
  SECRET_MANAGER_ENABLED: Type.Boolean({ default: false, description: "Enable Secret Manager integration" }),
  APP_ENVIRONMENT: Type.Union([Type.Literal("development"), Type.Literal("staging"), Type.Literal("production")], {
    default: "development",
    description: "Application environment label",
  }),
  APP_URL: Type.String({ default: "http://localhost:3000", description: "Base URL for the application" }),
  GITHUB_TOKEN: Type.Optional(Type.String({ description: "GitHub API token for authenticated requests" })),
});

export const env = Value.Decode(EnvSchema, {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  HOST: process.env.HOST,
  LOG_LEVEL: process.env.LOG_LEVEL,
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_PROJECT_NUMBER: process.env.FIREBASE_PROJECT_NUMBER,
  SECRET_MANAGER_ENABLED: process.env.SECRET_MANAGER_ENABLED,
  APP_ENVIRONMENT: process.env.APP_ENVIRONMENT,
  APP_URL: process.env.APP_URL,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
});

export type Env = typeof env;
