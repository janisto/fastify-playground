import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { ErrorModelSchema } from "../../schemas/index.js";
import { PaginationQuerySchema } from "../../schemas/pagination.js";
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
        description: "Returns public profile information for a GitHub user.",
        summary: "Get a GitHub user",
        tags: ["GitHub"],
        params: OwnerParamsSchema,
        response: {
          200: GitHubOwnerSchema,
          404: ErrorModelSchema,
          429: ErrorModelSchema,
          502: ErrorModelSchema,
        },
      },
    },
    async (request) => {
      return service.getOwner(request.params.owner);
    },
  );

  // GET /owners/:owner/repos
  fastify.get(
    "/owners/:owner/repos",
    {
      schema: {
        description: "Returns a list of public repositories for a GitHub user.",
        summary: "List user repositories",
        tags: ["GitHub"],
        params: OwnerParamsSchema,
        response: {
          200: GitHubOwnerReposResponseSchema,
          404: ErrorModelSchema,
          429: ErrorModelSchema,
          502: ErrorModelSchema,
        },
      },
    },
    async (request) => {
      return service.listOwnerRepos(request.params.owner);
    },
  );

  // GET /repos/:owner/:repo
  fastify.get(
    "/repos/:owner/:repo",
    {
      schema: {
        description: "Returns detailed information for a GitHub repository.",
        summary: "Get a repository",
        tags: ["GitHub"],
        params: RepoParamsSchema,
        response: {
          200: GitHubRepoDetailSchema,
          404: ErrorModelSchema,
          429: ErrorModelSchema,
          502: ErrorModelSchema,
        },
      },
    },
    async (request) => {
      return service.getRepo(request.params.owner, request.params.repo);
    },
  );

  // GET /repos/:owner/:repo/activity (paginated)
  fastify.get(
    "/repos/:owner/:repo/activity",
    {
      schema: {
        description:
          "Returns a paginated list of repository activities. Use the cursor from the Link header to navigate.",
        summary: "List repository activity",
        tags: ["GitHub"],
        params: RepoParamsSchema,
        querystring: PaginationQuerySchema,
        response: {
          200: GitHubActivityListResponseSchema,
          400: ErrorModelSchema,
          404: ErrorModelSchema,
          429: ErrorModelSchema,
          502: ErrorModelSchema,
        },
      },
    },
    async (request, reply) => {
      const { owner, repo } = request.params;
      const { cursor, limit = 20 } = request.query;

      const result = await service.listRepoActivity(owner, repo, { cursor, limit });

      const query = new URLSearchParams({ limit: String(limit) });
      const linkHeader = buildLinkHeader(
        `/v1/github/repos/${owner}/${repo}/activity`,
        query,
        result.nextCursor,
        undefined,
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
        description: "Returns the languages used in a repository with byte counts.",
        summary: "List repository languages",
        tags: ["GitHub"],
        params: RepoParamsSchema,
        response: {
          200: GitHubLanguagesResponseSchema,
          404: ErrorModelSchema,
          429: ErrorModelSchema,
          502: ErrorModelSchema,
        },
      },
    },
    async (request) => {
      return service.listRepoLanguages(request.params.owner, request.params.repo);
    },
  );

  // GET /repos/:owner/:repo/tags
  fastify.get(
    "/repos/:owner/:repo/tags",
    {
      schema: {
        description: "Returns a list of tags for a repository.",
        summary: "List repository tags",
        tags: ["GitHub"],
        params: RepoParamsSchema,
        response: {
          200: GitHubTagsResponseSchema,
          404: ErrorModelSchema,
          429: ErrorModelSchema,
          502: ErrorModelSchema,
        },
      },
    },
    async (request) => {
      return service.listRepoTags(request.params.owner, request.params.repo);
    },
  );
};

export default githubRoutes;
