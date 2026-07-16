---
name: typebox-schemas
description: Create or change fastify-playground TypeBox request, response, shared, environment, validation, and schema-discovery contracts, including defaults, formats, constraints, type inference, OpenAPI components, and tests.
---

# TypeBox schemas

Read `AGENTS.md`, the affected route or environment module, neighboring schemas, and their tests before editing a contract.

## Route schemas

1. Use `Type` from `@fastify/type-provider-typebox` for Fastify route contracts and `FastifyPluginAsyncTypebox` for typed routes.
2. Model params, query, headers, body, and every reachable response. Reuse `ErrorModelSchema` for errors.
3. Encode constraints the runtime enforces: formats, defaults, lengths, numeric bounds, and accepted object fields.
4. Add `$id` only to reusable response schemas. Register or reference them when OpenAPI components or `/schemas/<Name>.json` must expose them.
5. Keep JSON fields camelCase and map upstream or persistence representations at their boundary.

## Environment schemas

Use standalone `typebox` and `typebox/value` before Fastify creation. Decode with `Value.Decode` so defaults, conversion, cleaning, and assertion run. Include only variables consumed by the application.

Read `process.env` with bracket notation under the strict TypeScript index-signature policy. Never include credential values in schema examples or test output.

## Verification

Apply `$adversarial-testing`. Test meaningful valid values, defaults or coercion, boundary violations, unknown or missing fields, and response serialization. Identify the plausible weakening, removal, or boundary mutation each case catches.

For public schemas, also apply `$openapi-contract`. Run focused tests first, then `just check` and `pnpm --dir app build`.
