---
name: fastify-endpoint
description: Create or change fastify-playground Fastify endpoints, including module routing, TypeBox validation, authentication, JSON or CBOR responses, Problem Details, pagination, schema discovery, OpenAPI metadata, and tests.
---

# Fastify endpoints

Read `AGENTS.md`, the affected module, `app/src/routes/v1.ts`, and neighboring route tests before editing an endpoint.

## Workflow

1. Trace the existing module boundary through `index.ts`, `routes.ts`, `schemas.ts`, and any service or external client.
2. Define or update request, success, and reachable error schemas before changing the handler. Use `$typebox-schemas` for non-trivial schema work.
3. Change business or upstream behavior in the service or client. Construct dependencies once at plugin registration and pass `request.signal` through every outbound layer.
4. Keep the route handler limited to HTTP input, service invocation, status and headers, and response mapping.
5. Export new feature routes from the module index and register business modules under `/v1` in `app/src/routes/v1.ts`. Keep infrastructure routes unversioned.
6. Apply `$adversarial-testing`, then cover the route at the narrowest boundary that proves its public behavior.

## Contract checklist

- Use `FastifyPluginAsyncTypebox` and schema every request input and reachable response.
- Define a stable unique `operationId`, accurate summary, description, tags, constraints, success response, and reachable `ErrorModelSchema` statuses.
- Declare the formats the route implements with `schema.consumes` and `schema.produces`; do not advertise media types supplied only by a serializer or parser elsewhere.
- Protect authenticated routes with `preHandler: [fastify.authenticate]` and derive identity from `request.user`.
- Use the existing content-negotiation, pagination, and link-header utilities. Do not implement route-local variants.
- Add `$id` only to reusable response schemas and register them when OpenAPI components or `/schemas/<Name>.json` must expose them.
- Preserve controlled upstream errors and generic production 5xx details.

For a public contract change, also apply `$openapi-contract` and verify generated documentation, schema discovery when applicable, runtime media types, and response headers.

## Verification

Run the focused test first, then:

```bash
just check
pnpm --dir app build
```
