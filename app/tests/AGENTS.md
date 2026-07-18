# Test guidance

Rules for tests under `app/tests/`. The root `AGENTS.md` also applies.

## Layout

- `unit/`: isolated tests mirroring `app/src/`.
- `integration/`: application-level or real-service contract tests.
- `property/`: bounded fast-check properties for repository-owned invariants.
- `mocks/`: reusable external-service substitutes.
- `helpers/`: shared test utilities.

Name tests `*.test.ts` and keep fixtures close to the test unless multiple files share them.

## Vitest contract

- Import `describe`, `it`, `expect`, hooks, and mocks explicitly from `vitest`; globals are disabled.
- The environment is Node.js. Do not add inline environment directives.
- Tests and hooks have a 10-second timeout.
- Mocks are cleared, reset, and restored between tests.
- Use `response.json()` for JSON injection responses and decode CBOR payloads explicitly.
- Always close Fastify instances. Call `ready()` before assertions that depend on plugin boot.
- `fastify.register()` is synchronous; do not await it. Await `fastify.ready()` instead.

## Isolation

- Unit tests must not use real network, filesystem, Firebase, or credentials.
- Use `fastify.inject()` for HTTP behavior. Bind only to loopback with port `0` in an integration test when transport-level behavior such as listener shutdown cannot be modeled by injection, and always close the listener in `finally`.
- Use Undici `MockAgent` for external HTTP clients and local Firebase mocks for infrastructure plugins.
- Direct real-GitHub client integration tests are gated by the API `GITHUB_TOKEN` and skipped when it is absent. The running API must not consume that variable; it is unrelated to the Merge `GITHUB_TOKEN` used by GitHub Actions.
- Keep tests deterministic: no wall-clock timing assumptions, random ordering, or dependency on execution order.
- Property tests must bound collection, string, byte, and run counts. Do not use network, filesystem, credentials, or
  wall-clock state in generated cases, and close each generated Fastify instance in `finally` or hooks.

## Assertions and typing

- Apply `.agents/skills/adversarial-testing/SKILL.md` before changing tests. Rank likely failures and keep only cases that detect a meaningful production mutation.
- Assert public behavior and contracts rather than private implementation details.
- Use behavioral names describing the condition and outcome. Avoid `should`, registration-only tests, existence assertions when an exact value is knowable, and tests of third-party APIs.
- Cover success, error, validation, content negotiation, and boundary cases.
- For observability tests, inspect the raw JSON line before parsing when field uniqueness matters. Assert one terminal record, canonical snake_case correlation fields, final status, and absence of request secrets.
- Use `.at()` or another guarded lookup when accessing arrays; unchecked index access is enabled.
- Omit absent optional properties in typed fixtures instead of assigning `undefined`.
- Use bracket notation for values typed through index signatures.
- Avoid non-null assertions and broad casts. Narrow `unknown` values at the boundary.
- Import `fc` and `test` from `@fast-check/vitest` only in property files. Import assertions and hooks explicitly from
  `vitest` as usual.

## Property replay and regressions

Routine tests run each property with fast-check's bounded default of 100 successful cases. Use `just fuzz` for a
longer property-only campaign. Replay a failure exactly with:

```bash
FUZZ_RUNS=1000 FUZZ_SEED=<seed> FUZZ_PATH=<path> just fuzz
```

`FUZZ_PATH` is valid only with `FUZZ_SEED`. Promote a minimized failure to a named example test when it captures a
stable contract, and retain the property to search adjacent input space. Do not commit generated random corpora.

## Coverage

`pnpm test:coverage` runs the full suite and measures all `src/**/*.ts` files, including the application entry point. Global thresholds are 90% for lines, functions, branches, and statements.

Use coverage exclusions only for boundaries that cannot be exercised safely, such as process signal entry points:

```typescript
/* v8 ignore next -- @preserve */
process.on("SIGTERM", shutdown);
```

For blocks, use matching `/* v8 ignore start -- @preserve */` and `/* v8 ignore stop -- @preserve */` comments. The `@preserve` marker is required so the transform does not strip the directive.

## Validation

Run the narrowest relevant file while iterating, then the complete gates:

```bash
(cd app && corepack pnpm exec vitest run tests/unit/path/to/file.test.ts)
just check
```
