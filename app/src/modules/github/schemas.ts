import { type Static, Type } from "@fastify/type-provider-typebox";
import { SafeIntegerSchema, TimestampSchema } from "../../schemas/portable.js";

const HttpUrlSchema = Type.String({ format: "uri", pattern: "^[Hh][Tt][Tt][Pp][Ss]?://" });
const NonEmptyString = Type.String({ minLength: 1 });
const NullableString = Type.Union([NonEmptyString, Type.Null()]);
const NullableAnyString = Type.Union([Type.String(), Type.Null()]);

export const OwnerParamsSchema = Type.Object(
  {
    owner: Type.String({
      description: "Safe GitHub account path segment",
      examples: ["octocat"],
      minLength: 1,
      maxLength: 39,
      pattern: "^(?:[A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9_-]{0,37}[A-Za-z0-9])$",
    }),
  },
  { additionalProperties: false },
);

export const RepoParamsSchema = Type.Object(
  {
    ...OwnerParamsSchema.properties,
    repo: Type.String({
      description: "Safe non-dot-only GitHub repository path segment",
      examples: ["git-consortium"],
      minLength: 1,
      maxLength: 100,
      pattern: "^(?=.*[A-Za-z0-9_-])[A-Za-z0-9._-]+$",
    }),
  },
  { additionalProperties: false },
);

export const GitHubOwnerSchema = Type.Object(
  {
    id: SafeIntegerSchema,
    login: NonEmptyString,
    type: NonEmptyString,
    name: NullableString,
    avatarUrl: HttpUrlSchema,
    htmlUrl: HttpUrlSchema,
    company: NullableString,
    blog: NullableString,
    location: NullableString,
    bio: NullableString,
    publicRepos: SafeIntegerSchema,
    followers: SafeIntegerSchema,
    following: SafeIntegerSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  },
  { $id: "GitHubOwner", additionalProperties: false },
);

const GitHubRepoSummaryProperties = {
  id: SafeIntegerSchema,
  name: NonEmptyString,
  fullName: NonEmptyString,
  description: NullableString,
  htmlUrl: HttpUrlSchema,
  fork: Type.Boolean(),
} as const;

export const GitHubRepoSchema = Type.Object(GitHubRepoSummaryProperties, {
  $id: "GitHubRepositorySummary",
  additionalProperties: false,
});

export const GitHubRepoDetailSchema = Type.Object(
  {
    ...GitHubRepoSummaryProperties,
    language: NullableAnyString,
    stargazersCount: SafeIntegerSchema,
    forksCount: SafeIntegerSchema,
    openIssuesCount: SafeIntegerSchema,
    archived: Type.Boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    pushedAt: Type.Union([TimestampSchema, Type.Null()]),
    defaultBranch: NonEmptyString,
    license: NullableString,
    topics: Type.Array(Type.String(), { uniqueItems: true }),
    disabled: Type.Boolean(),
  },
  { $id: "GitHubRepository", additionalProperties: false },
);

export const GitHubActivitySchema = Type.Object(
  {
    id: SafeIntegerSchema,
    actor: NullableString,
    actorAvatarUrl: Type.Union([HttpUrlSchema, Type.Null()]),
    ref: NonEmptyString,
    timestamp: TimestampSchema,
    activityType: NonEmptyString,
  },
  { $id: "GitHubActivity", additionalProperties: false },
);

export const GitHubLanguageSchema = Type.Object(
  { name: NonEmptyString, bytes: SafeIntegerSchema },
  { additionalProperties: false },
);

export const GitHubTagSchema = Type.Object(
  {
    name: NonEmptyString,
    commit: Type.Object(
      { sha: Type.String({ pattern: "^(?:[0-9a-f]{40}|[0-9a-f]{64})$" }) },
      { additionalProperties: false },
    ),
  },
  { $id: "GitHubTag", additionalProperties: false },
);

export const GitHubOwnerReposResponseSchema = Type.Object(
  { repos: Type.Array(GitHubRepoSchema, { maxItems: 100 }), count: Type.Integer({ minimum: 0, maximum: 100 }) },
  { $id: "GitHubRepositoryPage", additionalProperties: false },
);
export const GitHubActivityListResponseSchema = Type.Object(
  {
    activities: Type.Array(GitHubActivitySchema, { maxItems: 100 }),
    count: Type.Integer({ minimum: 0, maximum: 100 }),
  },
  { $id: "GitHubActivityPage", additionalProperties: false },
);
export const GitHubLanguagesResponseSchema = Type.Object(
  { languages: Type.Array(GitHubLanguageSchema) },
  { $id: "GitHubLanguages", additionalProperties: false },
);
export const GitHubTagsResponseSchema = Type.Object(
  { tags: Type.Array(GitHubTagSchema, { maxItems: 100 }), count: Type.Integer({ minimum: 0, maximum: 100 }) },
  { $id: "GitHubTagPage", additionalProperties: false },
);

export type GitHubOwner = Static<typeof GitHubOwnerSchema>;
export type GitHubRepo = Static<typeof GitHubRepoSchema>;
export type GitHubRepoDetail = Static<typeof GitHubRepoDetailSchema>;
export type GitHubActivity = Static<typeof GitHubActivitySchema>;
export type GitHubLanguage = Static<typeof GitHubLanguageSchema>;
export type GitHubTag = Static<typeof GitHubTagSchema>;
