# Test guidance

Rules for tests under `app/tests/`. The root `AGENTS.md` also applies.

## Layout

- `unit/`: isolated tests mirroring `app/src/`.
- `integration/`: application-level or real-service contract tests.
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

- Unit tests must not use real network, filesystem, Firebase, Firestore, or credentials.
- Use `fastify.inject()` instead of binding a port.
- Use Undici `MockAgent` for external HTTP clients and local Firebase mocks for infrastructure plugins.
- Real GitHub integration tests are gated by `GITHUB_TOKEN` and skipped when it is absent.
- Keep tests deterministic: no wall-clock timing assumptions, random ordering, or dependency on execution order.

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
pnpm --dir app exec vitest run tests/unit/path/to/file.test.ts
just check
```
