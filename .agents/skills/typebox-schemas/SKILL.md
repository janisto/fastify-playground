---
name: typebox-schemas
description: Create or change fastify-playground TypeBox request, response, shared, environment, validation, and schema-discovery contracts, including defaults, formats, constraints, type inference, OpenAPI components, and tests.
---

# TypeBox schemas

Read `AGENTS.md`, the affected route or environment module, neighboring schemas, and schema and route tests before editing a contract.

## Route schemas

- Use `Type` from `@fastify/type-provider-typebox` inside `FastifyPluginAsyncTypebox` routes.
- Define params, query, headers, body, and every reachable response in the route schema.
- Add useful descriptions, formats, defaults, bounds, and examples that runtime validation actually honors.
- Add `$id` to reusable response schemas and register or reference them so OpenAPI and `/schemas/<Name>.json` can discover them.
- Reuse `ErrorModelSchema` for RFC 9457 errors.
- Keep API fields camelCase and Firestore fields snake_case; map them at the persistence boundary.

## Environment schemas

Use standalone `typebox` and `typebox/value` before Fastify creation. Decode with `Value.Decode` so defaults, conversion, cleaning, and assertion run. Pass only supported environment variables and remove settings with no consumer.

Read `process.env` with bracket notation under the strict TypeScript index-signature policy. Never include credential values in schema examples or test output.

## Verification

Test valid values, defaults, coercion, minimum and maximum boundaries, invalid unions or formats, unknown or missing fields, and response serialization. When a public schema changes, use `openapi-contract` to inspect generated components and schema discovery too.

Run the focused tests, then `just lint`, `just typing`, and `just test`.
