---
name: openapi-contract
description: Maintain and verify fastify-playground generated OpenAPI 3.1, Fastify route metadata, TypeBox component schemas, Firebase bearer security, RFC 9457 errors, content types, response headers, and schema discovery when public API behavior changes.
---

# OpenAPI contract maintenance

Read `AGENTS.md`, `app/src/plugins/swagger.ts`, `app/src/routes/schemas.ts`, `app/src/plugins/schema-registry.ts`, and the affected routes, schemas, error handling, and tests before changing the public API.

## Connected surfaces

Treat the contract as one system:

1. Route TypeBox schemas define validation, serialization, and operation metadata.
2. `@fastify/swagger` produces OpenAPI 3.1 at `/api-docs/json` and `/api-docs/yaml`.
3. Swagger UI renders the contract at `/api-docs`.
4. `/schemas/<Name>.json` serves standalone Draft 2020-12 schemas with local `$defs` as `application/schema+json`, while successful modeled responses receive `Link` discovery metadata without a `$schema` instance property.
5. Runtime plugins implement RFC 9457 JSON or CBOR errors, bearer authentication, content negotiation, request IDs, and pagination headers.

Do not add a hand-maintained OpenAPI file or commit generated specifications.

## Contract rules

- Keep summaries, descriptions, tags, paths, methods, parameters, constraints, and reachable statuses accurate.
- Give every public operation a stable, unique `operationId`, use the relative `/` server, and register Swagger before every route-producing plugin.
- Reference reusable `$id` schemas and keep component names stable unless the change is intentionally breaking.
- Document Firebase bearer security only on protected operations.
- Document implemented JSON, CBOR, Problem Details, and schema media types accurately.
- Keep route `schema.consumes` and `schema.produces` aligned with the runtime negotiation plugin. Error responses advertise `application/problem+json` and registered `application/cbor`, never `application/problem+cbor`.
- Keep `Link`, `Vary`, `X-Request-ID`, `Retry-After`, and authentication headers aligned with runtime behavior.
- Ensure every advertised schema resolves and every runtime error shape matches `ErrorModelSchema`.
- Avoid unrelated schema churn.

## Verification

Exercise the composed application with `fastify.inject()`. Inspect `/api-docs/json`, affected operation objects and components, `/schemas/<Name>.json`, and representative runtime responses. Add contract assertions for changed statuses, security, media types, schemas, and headers.

Run focused contract tests, then `just lint`, `just typing`, and `just test`.
