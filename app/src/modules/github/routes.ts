import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { ErrorModelSchema } from "../../schemas/index.js";
import { PaginationQuerySchema } from "../../schemas/pagination.js";
import { API_MEDIA_TYPES } from "../../utils/content-negotiation.js";
import { buildLinkHeader } from "../../utils/pagination.js";

import {
  GitHubActivityListResponseSchema,
  GitHubActivitySchema,
  GitHubLanguagesResponseSchema,
  GitHubOwnerReposResponseSchema,
  GitHubOwnerSchema,
  GitHubRepoDetailSchema,
  GitHubRepoSchema,
  GitHubTagSchema,
  GitHubTagsResponseSchema,
  OwnerParamsSchema,
  RepoParamsSchema,
} from "./schemas.js";
import { GitHubService } from "./service.js";

const githubRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  const service = new GitHubService();

  // Register schemas for OpenAPI
  fastify.addSchema(GitHubOwnerSchema);
  fastify.addSchema(GitHubRepoSchema);
  fastify.addSchema(GitHubRepoDetailSchema);
  fastify.addSchema(GitHubActivitySchema);
  fastify.addSchema(GitHubTagSchema);
  fastify.addSchema(GitHubOwnerReposResponseSchema);
  fastify.addSchema(GitHubActivityListResponseSchema);
  fastify.addSchema(GitHubLanguagesResponseSchema);
  fastify.addSchema(GitHubTagsResponseSchema);

  // GET /owners/:owner
  fastify.get(
    "/owners/:owner",
    {
      schema: {
        operationId: "getGitHubOwner",
        security: [],
        description:
          "Read selected public GitHub user fields through anonymous upstream access. No server or caller credential is forwarded; missing or non-public resources return github_not_found. No application data is changed.",
        summary: "Get a GitHub user",
        tags: ["GitHub"],
        produces: API_MEDIA_TYPES,
        params: OwnerParamsSchema,
        response: {
          200: GitHubOwnerSchema,
          400: ErrorModelSchema,
          404: ErrorModelSchema,
          406: ErrorModelSchema,
          422: ErrorModelSchema,
          429: ErrorModelSchema,
          500: ErrorModelSchema,
          502: ErrorModelSchema,
          503: ErrorModelSchema,
          504: ErrorModelSchema,
        },
      },
    },
    async (request) => {
      return service.getOwner(request.params.owner, request.signal);
    },
  );

  // GET /owners/:owner/repos
  fastify.get(
    "/owners/:owner/repos",
    {
      schema: {
        operationId: "listGitHubOwnerRepositories",
        security: [],
        description:
          "Read one provider-ordered page of public user repositories anonymously. Follow next/prev Link targets without constructing or changing cursors or page size; no total is promised. Observe Retry-After on quota failures and use a bounded retry budget.",
        summary: "List user repositories",
        tags: ["GitHub"],
        produces: API_MEDIA_TYPES,
        params: OwnerParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: GitHubOwnerReposResponseSchema,
          400: ErrorModelSchema,
          404: ErrorModelSchema,
          406: ErrorModelSchema,
          422: ErrorModelSchema,
          429: ErrorModelSchema,
          500: ErrorModelSchema,
          502: ErrorModelSchema,
          503: ErrorModelSchema,
          504: ErrorModelSchema,
        },
      },
    },
    async (request, reply) => {
      const { owner } = request.params;
      const { cursor, limit = 20 } = request.query;
      const result = await service.listOwnerRepos(owner, { limit, ...(cursor ? { cursor } : {}) }, request.signal);
      const linkHeader = buildLinkHeader(
        `/v1/github/owners/${encodeURIComponent(owner)}/repos`,
        new URLSearchParams({ limit: String(limit) }),
        result.nextCursor,
        result.prevCursor,
      );
      if (linkHeader) reply.header("Link", linkHeader);
      return { repos: result.items, count: result.items.length };
    },
  );

  // GET /repos/:owner/:repo
  fastify.get(
    "/repos/:owner/:repo",
    {
      schema: {
        operationId: "getGitHubRepository",
        security: [],
        description:
          "Read selected fields of one publicly visible GitHub repository anonymously. Private or missing repositories return github_not_found. This performs an upstream read and changes no application data.",
        summary: "Get a repository",
        tags: ["GitHub"],
        produces: API_MEDIA_TYPES,
        params: RepoParamsSchema,
        response: {
          200: GitHubRepoDetailSchema,
          400: ErrorModelSchema,
          404: ErrorModelSchema,
          406: ErrorModelSchema,
          422: ErrorModelSchema,
          429: ErrorModelSchema,
          500: ErrorModelSchema,
          502: ErrorModelSchema,
          503: ErrorModelSchema,
          504: ErrorModelSchema,
        },
      },
    },
    async (request) => {
      return service.getRepo(request.params.owner, request.params.repo, request.signal);
    },
  );

  // GET /repos/:owner/:repo/activity (paginated)
  fastify.get(
    "/repos/:owner/:repo/activity",
    {
      schema: {
        operationId: "listGitHubRepositoryActivity",
        security: [],
        description:
          "Read one newest-first page of public repository activity anonymously. Follow opaque next/prev Link targets with the same page size; the live provider collection may change between requests. Observe quota delay hints and bound retries.",
        summary: "List repository activity",
        tags: ["GitHub"],
        produces: API_MEDIA_TYPES,
        params: RepoParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: GitHubActivityListResponseSchema,
          400: ErrorModelSchema,
          404: ErrorModelSchema,
          406: ErrorModelSchema,
          422: ErrorModelSchema,
          429: ErrorModelSchema,
          500: ErrorModelSchema,
          502: ErrorModelSchema,
          503: ErrorModelSchema,
          504: ErrorModelSchema,
        },
      },
    },
    async (request, reply) => {
      const { owner, repo } = request.params;
      const { cursor, limit = 20 } = request.query;

      const result = await service.listRepoActivity(
        owner,
        repo,
        {
          limit,
          ...(cursor ? { cursor } : {}),
        },
        request.signal,
      );

      const query = new URLSearchParams({ limit: String(limit) });
      const linkHeader = buildLinkHeader(
        `/v1/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/activity`,
        query,
        result.nextCursor,
        result.prevCursor,
      );

      if (linkHeader) {
        reply.header("Link", linkHeader);
      }

      return { activities: result.items, count: result.items.length };
    },
  );

  // GET /repos/:owner/:repo/languages
  fastify.get(
    "/repos/:owner/:repo/languages",
    {
      schema: {
        operationId: "listGitHubRepositoryLanguages",
        security: [],
        description:
          "Read public repository language byte counts anonymously, ordered by descending count and then name. This is a single upstream read without pagination or application mutation.",
        summary: "List repository languages",
        tags: ["GitHub"],
        produces: API_MEDIA_TYPES,
        params: RepoParamsSchema,
        response: {
          200: GitHubLanguagesResponseSchema,
          400: ErrorModelSchema,
          404: ErrorModelSchema,
          406: ErrorModelSchema,
          422: ErrorModelSchema,
          429: ErrorModelSchema,
          500: ErrorModelSchema,
          502: ErrorModelSchema,
          503: ErrorModelSchema,
          504: ErrorModelSchema,
        },
      },
    },
    async (request) => {
      return service.listRepoLanguages(request.params.owner, request.params.repo, request.signal);
    },
  );

  // GET /repos/:owner/:repo/tags
  fastify.get(
    "/repos/:owner/:repo/tags",
    {
      schema: {
        operationId: "listGitHubRepositoryTags",
        security: [],
        description:
          "Read one provider-ordered public tag page anonymously. Follow next/prev Link targets with the same page size; the response count describes this page, not the repository total. Respect Retry-After on quota failures and bound retries.",
        summary: "List repository tags",
        tags: ["GitHub"],
        produces: API_MEDIA_TYPES,
        params: RepoParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: GitHubTagsResponseSchema,
          400: ErrorModelSchema,
          404: ErrorModelSchema,
          406: ErrorModelSchema,
          422: ErrorModelSchema,
          429: ErrorModelSchema,
          500: ErrorModelSchema,
          502: ErrorModelSchema,
          503: ErrorModelSchema,
          504: ErrorModelSchema,
        },
      },
    },
    async (request, reply) => {
      const { owner, repo } = request.params;
      const { cursor, limit = 20 } = request.query;
      const result = await service.listRepoTags(owner, repo, { limit, ...(cursor ? { cursor } : {}) }, request.signal);
      const linkHeader = buildLinkHeader(
        `/v1/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags`,
        new URLSearchParams({ limit: String(limit) }),
        result.nextCursor,
        result.prevCursor,
      );
      if (linkHeader) reply.header("Link", linkHeader);
      return { tags: result.items, count: result.items.length };
    },
  );
};

export default githubRoutes;
