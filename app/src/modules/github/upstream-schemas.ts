import Type, { type StaticDecode } from "typebox";

const NullableString = Type.Union([Type.String(), Type.Null()]);
const DateTimeString = Type.String({ format: "date-time" });
const NullableDateTimeString = Type.Union([DateTimeString, Type.Null()]);
const UriString = Type.String({ format: "uri" });

const RepoProperties = {
  id: Type.Integer(),
  name: Type.String(),
  full_name: Type.String(),
  description: NullableString,
  html_url: UriString,
  language: NullableString,
  stargazers_count: Type.Integer({ minimum: 0 }),
  forks_count: Type.Integer({ minimum: 0 }),
  open_issues_count: Type.Integer({ minimum: 0 }),
  visibility: Type.String(),
  fork: Type.Boolean(),
  archived: Type.Boolean(),
  created_at: NullableDateTimeString,
  updated_at: NullableDateTimeString,
  pushed_at: NullableDateTimeString,
} as const;

export const RawGitHubOwnerSchema = Type.Object({
  login: Type.String(),
  id: Type.Integer(),
  avatar_url: UriString,
  html_url: UriString,
  type: Type.String(),
  name: NullableString,
  company: NullableString,
  blog: NullableString,
  location: NullableString,
  bio: NullableString,
  public_repos: Type.Integer({ minimum: 0 }),
  followers: Type.Integer({ minimum: 0 }),
  following: Type.Integer({ minimum: 0 }),
  created_at: DateTimeString,
  updated_at: DateTimeString,
});

export const RawGitHubRepoSchema = Type.Object(RepoProperties);

export const RawGitHubRepoDetailSchema = Type.Object({
  ...RepoProperties,
  default_branch: Type.String(),
  license: Type.Union([
    Type.Object({
      spdx_id: NullableString,
    }),
    Type.Null(),
  ]),
  topics: Type.Optional(Type.Array(Type.String())),
  disabled: Type.Boolean(),
});

export const RawGitHubActivitySchema = Type.Object({
  id: Type.Integer(),
  actor: Type.Union([
    Type.Object({
      login: Type.String(),
      avatar_url: UriString,
    }),
    Type.Null(),
  ]),
  ref: Type.String(),
  timestamp: DateTimeString,
  activity_type: Type.String(),
});

export const RawGitHubTagSchema = Type.Object({
  name: Type.String(),
  commit: Type.Object({
    sha: Type.String(),
    url: UriString,
  }),
});

export const RawGitHubOwnerReposSchema = Type.Array(RawGitHubRepoSchema);
export const RawGitHubActivityListSchema = Type.Array(RawGitHubActivitySchema);
export const RawGitHubLanguagesSchema = Type.Record(Type.String(), Type.Integer({ minimum: 0 }));
export const RawGitHubTagsSchema = Type.Array(RawGitHubTagSchema);

export type RawGitHubOwner = StaticDecode<typeof RawGitHubOwnerSchema>;
export type RawGitHubRepo = StaticDecode<typeof RawGitHubRepoSchema>;
export type RawGitHubRepoDetail = StaticDecode<typeof RawGitHubRepoDetailSchema>;
export type RawGitHubActivity = StaticDecode<typeof RawGitHubActivitySchema>;
