---
name: fastify-routes
description: Guide for creating Fastify route handlers with TypeBox schemas and OpenAPI documentation. Use when adding new routes to app/src/routes/.
---

# Fastify Route Development

This skill provides patterns for creating Fastify routes with TypeBox validation and OpenAPI documentation.

## Directory Structure

Routes are located in `app/src/routes/`. Each route file exports a default async function that registers routes on a Fastify instance.

## Route Template

```typescript
import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";

const routes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/endpoint",
    {
      schema: {
        description: "Endpoint description for OpenAPI docs",
        tags: ["tag-name"],
        summary: "Short summary",
        querystring: Type.Object({
          param: Type.String({ description: "Query parameter" }),
        }),
        response: {
          200: Type.Object({
            status: Type.Literal("ok"),
            data: Type.String({ description: "Response data" }),
          }),
          400: Type.Object({
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { param } = request.query;
      return { status: "ok", data: param };
    },
  );
};

export default routes;
```

## OpenAPI Schema Requirements

1. **Always include schema**: Every route handler must have a schema property
2. **Description and summary**: Required for OpenAPI documentation
3. **Tags**: Group related endpoints
4. **Response codes**: Document all possible response status codes
5. **TypeBox types**: Use `Type` from `@fastify/type-provider-typebox`

## Authentication

For protected routes, use the `fastify.authenticate` preHandler:

```typescript
fastify.get(
  "/protected",
  {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Protected endpoint requiring authentication",
      tags: ["protected"],
      response: {
        200: Type.Object({ userId: Type.String() }),
        401: Type.Object({ message: Type.String() }),
      },
    },
  },
  async (request) => {
    return { userId: request.user.uid };
  },
);
```

## HTTP Methods

Use appropriate HTTP methods:
- `GET` - Read operations
- `POST` - Create operations
- `PUT` - Full update operations
- `PATCH` - Partial update operations
- `DELETE` - Delete operations

## Error Handling

Use `@fastify/sensible` HTTP error helpers:

```typescript
// Throw errors
throw fastify.httpErrors.notFound("Resource not found");
throw fastify.httpErrors.badRequest("Invalid input");

// Reply methods
reply.notFound("Resource not found");
reply.badRequest("Invalid input");
```

## Existing Routes

- `health.ts` - Simple liveness probe at `/health`
- `root.ts` - Root endpoint at `/`

## Testing Requirements

Each route must have a corresponding test file in `app/tests/unit/routes/`. Test all HTTP methods, status codes, and validation errors.

## Commands

```bash
cd app
npm run build       # Build and verify TypeScript compilation
npm run check       # Run Biome linter and formatter
npm run test        # Run all tests
```

## Boundaries

- Do not create routes without TypeBox schemas
- Do not skip OpenAPI documentation (description, tags, summary)
- Always add corresponding unit tests for new routes
