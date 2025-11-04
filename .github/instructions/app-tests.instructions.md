---
applyTo: "app/tests/**"
---

Use these rules for tests under `app/tests/**` (Node 24, TS 5.9, Vitest).

Structure
- Unit tests → `app/tests/unit/**` (mirror `app/src/**` modules)
- Integration tests → `app/tests/integration/**` (mirror API structure)
- Mocks → `app/tests/mocks/**` (MSW for HTTP)
- Helpers → `app/tests/helpers/**`
- Setup → `app/tests/setup.ts`

Conventions
- No real network/filesystem/DB in unit tests; mock adapters and external calls.
- Use MSW to stub HTTP for integration where needed; prefer small adapters.
- Aim 90%+ overall coverage, 100% for critical business logic.
- Mapper files (`app/src/api/mappers/**`) must maintain 100% line & branch coverage (include negative guard tests).
- Each source file should have a matching test file.
- Keep Biome clean: `npm run check` (and `npm run check:fix` when needed).
- Do not add inline Vitest env comments (repository rules prohibit them).

Date & time handling in tests
- Construct domain objects with real `Date` instances; never insert ISO strings directly.
- When asserting API responses, expect ISO 8601 UTC strings produced via `toIso` / `isoNow` helpers (not raw Firestore timestamps).
- For mapper round-trip tests: generate a `Date`, persist via `dateToFirestore`, read via `dateFromFirestore`, assert `getTime()` equality.
- Use fixtures that keep temporal fields as `Date` until serialization.
- Avoid calling `.toISOString()` in test code except comparing to helper output (`expect(toIso(d)).toBe(d.toISOString())`). Prefer `toIso(d)` for clarity.
- Do not call `toIso` from tests to shape domain objects passed into handlers/services (let mappers serialize). Only assert mapper output uses ISO UTC.
- Add explicit negative tests exercising mapper guard paths (e.g., missing required IDs / timestamps) to keep 100% branch coverage.

Run commands (from repo root)
1) `cd app`
2) `npm run test` (or `npm run test:coverage`)

Writing tests
- Use realistic fixtures; avoid PII.
- For routes, cover: auth, validation errors, success, edge cases.
- Assert contract matches OpenAPI: status codes, body shapes, and error schema.
- Prefer explicit type imports: `import type { ... } from "pkg"`.

Quality gates
- Types compile: `cd app && npm run build`
- Lint/format clean: `cd app && npm run check`
- Tests pass: `cd app && npm run test`

When API changes
- Update related tests and OpenAPI docs in `app/openapi/**`.
- Ensure `redocly lint` passes and examples match actual responses.
