---
name: fastify-endpoint
description: Create or change fastify-playground Fastify endpoints, including module routing, TypeBox validation, authentication, JSON or CBOR responses, Problem Details, pagination, schema discovery, OpenAPI metadata, and tests.
---

# Fastify endpoints

Read `AGENTS.md`, the neighboring module or route, `app/src/routes/v1.ts`, relevant schemas and services, and existing route tests before editing an endpoint.

## Boundaries

- Put feature routes in `app/src/modules/<name>/routes.ts` and export them from the module index.
- Keep transport logic in routes and business behavior in services. Construct services once during plugin registration.
- Register business modules under `/v1` through `app/src/routes/v1.ts`; keep health and schema discovery unversioned.
- Use `FastifyPluginAsyncTypebox` and TypeBox schemas for params, query, body, headers, and every reachable response.
- Use `.js` relative imports and explicit type imports.

## Public contract

Define a stable unique `operationId`, accurate summary, description, tags, validation constraints, success schema, and all reachable Problem Details statuses. Reuse `ErrorModelSchema`; do not invent an error envelope.

Use camelCase for API fields. Add `$id` to reusable response schemas so schema discovery can advertise them. Declare owned request and response formats with `schema.consumes` and `schema.produces`. Preserve strict JSON and CBOR behavior, `Vary: Accept, Origin`, and RFC 8288 `Link` headers; response instances must not receive the JSON Schema `$schema` keyword.

Protect authenticated routes with `preHandler: [fastify.authenticate]`. Never accept a client-selected identity in place of `request.user`.

For outbound work, pass `request.signal` through the service and client layers. Keep external deadlines below the application handler deadline, validate successful upstream payloads, and expose controlled errors rather than provider details.

Use 200 for reads, 201 for creation, and 204 only when there is no response body. Cursors are canonical unpadded Base64URL with a 2,048-character maximum. Reject malformed, empty, invalid UTF-8, wrong-resource, and stale cursors; previous links must navigate to the preceding page without repeating the current page. Treat schema validation failures as 422. Throw the narrowest `@fastify/sensible` error and let the global handler produce RFC 9457 responses.

## Workflow

1. Update request, response, and shared schemas.
2. Update the service or external client contract.
3. Implement the thin route and register a new module if required.
4. Add route tests for success, validation, authentication, errors, headers, and representative JSON and CBOR behavior.
5. Inspect `/api-docs/json` and `/schemas/<Schema>.json` when the public contract changes; use the `openapi-contract` skill too.

Run the focused test, then `just lint`, `just typing`, and `just test`.
