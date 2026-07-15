---
name: vitest-testing
description: Write or review fastify-playground Vitest unit and integration tests for Fastify plugins, routes, services, schemas, content negotiation, external clients, lifecycle behavior, TypeScript 7 strictness, and V8 coverage.
---

# Vitest testing

Read `AGENTS.md`, `app/tests/AGENTS.md`, the implementation under test, shared mocks or helpers, and neighboring tests before choosing a boundary.
Apply `.agents/skills/adversarial-testing/SKILL.md` and state the most important failure mode before writing test code.

## Choose the boundary

- Test pure services, schemas, utilities, and isolated plugins under `app/tests/unit/`.
- Test composed application behavior and real HTTP contracts under `app/tests/integration/` with `fastify.inject()`.
- Mock GitHub with Undici `MockAgent` and Firebase with shared local mocks.
- Keep direct real-GitHub client tests opt-in through the test-only `GITHUB_TOKEN`; do not add live network calls or ambient GitHub credentials to the default application suite.

Import Vitest APIs explicitly; globals are disabled. Register plugins, await `fastify.ready()` when boot matters, and always close instances. Do not await synchronous values such as `fastify.register()`.

Assert observable behavior: exact status, relevant headers, decoded JSON or CBOR shape, Problem Details, validation locations, authentication, pagination, request IDs, and safe logs. For observability, inspect raw JSON before parsing when duplicate fields matter; assert one terminal record, final status, canonical snake_case correlation fields, and absence of query, credential, cookie, and body canaries. Prefer tables for meaningful input matrices. Avoid sleeps, execution-order dependencies, non-null assertions, unchecked array indexes, and fixtures that assign `undefined` to optional fields.

Do not test that a mature dependency registers, exposes its documented helpers, or returns a configured mock value. Every retained test must identify a plausible removed, inverted, off-by-one, ordering, privacy, or cleanup mutation that it detects. Prefer fewer exact cases over broad repetitive coverage.

## Coverage and commands

The full suite measures all `src/**/*.ts` files. Global lines, functions, branches, and statements must remain at least 90%. Use V8 ignore comments only for genuinely untestable process boundaries and retain the `-- @preserve` marker.

Run a focused file first:

```bash
pnpm --dir app exec vitest run tests/unit/path/to/file.test.ts
```

Then run `just typing`, `just test`, and `just cov`; use `just check` for the complete non-mutating gate.
