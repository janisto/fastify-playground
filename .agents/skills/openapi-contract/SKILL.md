---
name: openapi-contract
description: Maintain and verify fastify-playground generated OpenAPI 3.1, Fastify route metadata, TypeBox component schemas, Firebase bearer security, RFC 9457 errors, content types, response headers, and schema discovery when public API behavior changes.
---

# OpenAPI contract maintenance

Read `AGENTS.md`, `app/src/plugins/swagger.ts`, `app/src/routes/schemas.ts`, `app/src/plugins/schema-registry.ts`, and the affected route, schema, runtime plugin, and tests before changing the public API.

## Trace the contract

Verify every changed behavior across the surfaces that own it:

1. Route TypeBox schemas own validation, serialization, operation metadata, and response status declarations.
2. `app/src/plugins/swagger.ts` owns OpenAPI 3.1 transformation, shared response headers, error media types, and bearer security components.
3. `app/src/plugins/schema-registry.ts`, `app/src/routes/schemas.ts`, and schema discovery own standalone Draft 2020-12 documents and response `Link` metadata.
4. Runtime plugins and utilities own negotiation, RFC 9457 encoding, authentication, request IDs, pagination, and headers.
5. `app/tests/integration/app.test.ts` proves the composed public contract; focused unit tests prove lower-level transformations and failure paths.

Do not add a hand-maintained OpenAPI file or commit generated specifications.

## Change checklist

- Keep summaries, descriptions, tags, paths, methods, parameters, constraints, and reachable statuses accurate.
- Keep every `operationId` stable and unique, preserve the relative `/` server, and register Swagger before route-producing plugins.
- Reference reusable `$id` schemas and keep component names stable unless breaking them is intentional.
- Document Firebase bearer security only on protected operations.
- Keep route `schema.consumes` and `schema.produces` aligned with runtime behavior.
- Advertise errors as `application/problem+json` and `application/cbor`, never `application/problem+cbor`.
- Keep `Link`, `Vary`, `X-Request-ID`, `Retry-After`, and authentication headers aligned with runtime behavior.
- Ensure every reference resolves, standalone schemas use local `$defs`, and runtime errors match `ErrorModelSchema`.
- Ensure response instances do not receive the JSON Schema `$schema` keyword.
- Avoid unrelated schema churn.

## Verification

Apply `$adversarial-testing`. Exercise the composed application with `fastify.inject()` and inspect `/api-docs/json`, affected operations and components, `/schemas/<Name>.json` when applicable, and representative runtime responses. Assert changed statuses, security, media types, schemas, and headers rather than snapshotting the entire generated document.

Run focused contract tests first, then `just check` and `pnpm --dir app build`.
