import { type Static, Type } from "@fastify/type-provider-typebox";

// Path Parameters
export const OwnerParamsSchema = Type.Object({
  owner: Type.String({
    description: "GitHub account name",
    examples: ["octocat"],
    minLength: 1,
    maxLength: 100,
  }),
});

export const RepoParamsSchema = Type.Object({
  owner: Type.String({
    description: "GitHub account name",
    examples: ["octocat"],
    minLength: 1,
    maxLength: 100,
  }),
  repo: Type.String({
    description: "Repository name",
    examples: ["git-consortium"],
    minLength: 1,
    maxLength: 100,
  }),
});

// Owner Schema
export const GitHubOwnerSchema = Type.Object(
  {
    login: Type.String({ examples: ["octocat"] }),
    id: Type.Integer({ examples: [1] }),
    avatarUrl: Type.String({ format: "uri" }),
    htmlUrl: Type.String({ format: "uri" }),
    type: Type.String({ examples: ["User"] }),
    name: Type.Union([Type.String(), Type.Null()]),
    company: Type.Union([Type.String(), Type.Null()]),
    blog: Type.Union([Type.String(), Type.Null()]),
    location: Type.Union([Type.String(), Type.Null()]),
    bio: Type.Union([Type.String(), Type.Null()]),
    publicRepos: Type.Integer(),
    followers: Type.Integer(),
    following: Type.Integer(),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { $id: "GitHubOwner" },
);

// Base Repo Schema (for property reuse, not exported)
const GitHubRepoBaseSchema = Type.Object({
  id: Type.Integer(),
  name: Type.String(),
  fullName: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  htmlUrl: Type.String({ format: "uri" }),
  language: Type.Union([Type.String(), Type.Null()]),
  stargazersCount: Type.Integer(),
  forksCount: Type.Integer(),
  openIssuesCount: Type.Integer(),
  visibility: Type.String(),
  fork: Type.Boolean(),
  archived: Type.Boolean(),
  createdAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  updatedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  pushedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

// Repo Summary Schema
export const GitHubRepoSchema = Type.Object(
  {
    ...GitHubRepoBaseSchema.properties,
  },
  { $id: "GitHubRepo" },
);

// Repo Detail Schema (extends base)
export const GitHubRepoDetailSchema = Type.Object(
  {
    ...GitHubRepoBaseSchema.properties,
    defaultBranch: Type.String({ description: "Default branch name" }),
    license: Type.Union([Type.String(), Type.Null()], { description: "License SPDX identifier" }),
    topics: Type.Array(Type.String(), { description: "Repository topics" }),
    disabled: Type.Boolean({ description: "Whether repo is disabled" }),
  },
  { $id: "GitHubRepoDetail" },
);

// Activity Schema
export const GitHubActivitySchema = Type.Object(
  {
    id: Type.Integer({ examples: [1] }),
    actor: Type.Union([Type.String(), Type.Null()], {
      examples: ["octocat"],
      description: "Actor username, or null when the GitHub account no longer exists",
    }),
    ref: Type.String({ examples: ["refs/heads/master"], description: "Git reference" }),
    timestamp: Type.String({ format: "date-time" }),
    activityType: Type.String({ examples: ["push"], description: "Type of activity" }),
    actorAvatarUrl: Type.Union([Type.String({ format: "uri" }), Type.Null()], {
      description: "Actor avatar URL, or null when the GitHub account no longer exists",
    }),
  },
  { $id: "GitHubActivity" },
);

// Language Schema
export const GitHubLanguageSchema = Type.Object({
  name: Type.String({ examples: ["TypeScript"] }),
  bytes: Type.Integer({ examples: [78769], description: "Bytes of code" }),
});

// Tag Schema
export const GitHubTagSchema = Type.Object(
  {
    name: Type.String({ description: "Tag name" }),
    commit: Type.Object({
      sha: Type.String({ description: "Commit SHA" }),
    }),
  },
  { $id: "GitHubTag" },
);

// Response Wrapper Schemas
export const GitHubOwnerReposResponseSchema = Type.Object(
  {
    repos: Type.Array(GitHubRepoSchema),
    count: Type.Integer({ description: "Number of repositories returned" }),
  },
  { $id: "GitHubOwnerReposResponse" },
);

export const GitHubActivityListResponseSchema = Type.Object(
  {
    activities: Type.Array(GitHubActivitySchema),
    count: Type.Integer({ description: "Number of activities returned" }),
  },
  { $id: "GitHubActivityListResponse" },
);

export const GitHubLanguagesResponseSchema = Type.Object(
  {
    languages: Type.Array(GitHubLanguageSchema, { description: "Repository languages with byte counts" }),
  },
  { $id: "GitHubLanguagesResponse" },
);

export const GitHubTagsResponseSchema = Type.Object(
  {
    tags: Type.Array(GitHubTagSchema),
    count: Type.Integer({ description: "Number of tags returned" }),
  },
  { $id: "GitHubTagsResponse" },
);

// TypeScript types derived from schemas
export type GitHubOwner = Static<typeof GitHubOwnerSchema>;
export type GitHubRepo = Static<typeof GitHubRepoSchema>;
export type GitHubRepoDetail = Static<typeof GitHubRepoDetailSchema>;
export type GitHubActivity = Static<typeof GitHubActivitySchema>;
export type GitHubLanguage = Static<typeof GitHubLanguageSchema>;
export type GitHubTag = Static<typeof GitHubTagSchema>;
