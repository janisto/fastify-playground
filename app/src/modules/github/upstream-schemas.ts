import Type, { type StaticDecode } from "typebox";

const SAFE_INTEGER_MAXIMUM = 9_007_199_254_740_991;
const SafeInteger = Type.Integer({ minimum: 0, maximum: SAFE_INTEGER_MAXIMUM });
const NonEmptyString = Type.String({ minLength: 1 });
const NullableString = Type.Union([NonEmptyString, Type.Null()]);
const OptionalDisplayString = Type.Optional(Type.Union([Type.String(), Type.Null()]));
const DateTimeString = Type.String({
  format: "date-time",
  pattern:
    "^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\\.[0-9]{3})?Z$",
});
const UriString = Type.String({ format: "uri", pattern: "^https?://" });

const RepoSummaryProperties = {
  id: SafeInteger,
  name: NonEmptyString,
  full_name: NonEmptyString,
  description: OptionalDisplayString,
  html_url: UriString,
  fork: Type.Boolean(),
  private: Type.Literal(false),
  visibility: Type.Literal("public"),
} as const;

export const RawGitHubOwnerSchema = Type.Object({
  login: NonEmptyString,
  id: SafeInteger,
  avatar_url: UriString,
  html_url: UriString,
  type: NonEmptyString,
  name: OptionalDisplayString,
  company: OptionalDisplayString,
  blog: OptionalDisplayString,
  location: OptionalDisplayString,
  bio: OptionalDisplayString,
  public_repos: SafeInteger,
  followers: SafeInteger,
  following: SafeInteger,
  created_at: DateTimeString,
  updated_at: DateTimeString,
});

export const RawGitHubRepoSchema = Type.Object(RepoSummaryProperties);
export const RawGitHubRepoDetailSchema = Type.Object({
  ...RepoSummaryProperties,
  language: NullableString,
  stargazers_count: SafeInteger,
  forks_count: SafeInteger,
  open_issues_count: SafeInteger,
  archived: Type.Boolean(),
  created_at: DateTimeString,
  updated_at: DateTimeString,
  pushed_at: Type.Union([DateTimeString, Type.Null()]),
  default_branch: NonEmptyString,
  license: Type.Optional(
    Type.Union([Type.Object({ spdx_id: Type.Optional(Type.Union([Type.String(), Type.Null()])) }), Type.Null()]),
  ),
  topics: Type.Optional(Type.Array(Type.String(), { uniqueItems: true })),
  disabled: Type.Boolean(),
});

export const RawGitHubActivitySchema = Type.Object({
  id: SafeInteger,
  actor: Type.Union([Type.Object({ login: NonEmptyString, avatar_url: UriString }), Type.Null()]),
  ref: NonEmptyString,
  timestamp: DateTimeString,
  activity_type: NonEmptyString,
});

export const RawGitHubTagSchema = Type.Object({
  name: NonEmptyString,
  commit: Type.Object({
    sha: Type.String({ pattern: "^(?:[0-9a-f]{40}|[0-9a-f]{64})$" }),
  }),
});

export const RawGitHubOwnerReposSchema = Type.Array(RawGitHubRepoSchema);
export const RawGitHubActivityListSchema = Type.Array(RawGitHubActivitySchema);
export const RawGitHubLanguagesSchema = Type.Record(NonEmptyString, SafeInteger);
export const RawGitHubTagsSchema = Type.Array(RawGitHubTagSchema);

export type RawGitHubOwner = StaticDecode<typeof RawGitHubOwnerSchema>;
export type RawGitHubRepo = StaticDecode<typeof RawGitHubRepoSchema>;
export type RawGitHubRepoDetail = StaticDecode<typeof RawGitHubRepoDetailSchema>;
export type RawGitHubActivity = StaticDecode<typeof RawGitHubActivitySchema>;
