---
applyTo: "functions/tests/**"
---

Use these rules for tests under `functions/tests/**` (Node 24, TS target ES2024, Vitest).

Structure
- Unit tests → `functions/tests/**/*.test.ts` mirroring `functions/src/**`
- Keep tests self-contained; no real network/services.

Run commands (from repo root)
1) `cd functions`
2) `npm run test` (or `npm run test:coverage`)

Conventions
- Match Node 24 runtime semantics.
- Explicit type imports only: `import type { ... } from "pkg"`.
- Keep Biome clean: `npm run check` (and `npm run check:fix` when needed).
- Do not add inline Vitest env comments (repository rules prohibit them).
- Prefer adapters with local stubs for any external service boundaries.

Date & time handling in tests
- Use native `Date` objects internally; never persist or assert on raw ISO strings except at explicit serialization boundaries.
- If functions code consumes shared utilities from `app/`, continue to rely on `dateToFirestore`, `dateFromFirestore`, `toIso`, `isoNow` (imported from the shared location or replicated if not shared—avoid ad-hoc conversions).
- Assert output timestamps are ISO UTC (`/Z$/`) and match `toIso(sourceDate)` when applicable.
- Avoid direct `.toISOString()` expectations unless comparing against helper output for verification.

Quality gates
- Types compile: `cd functions && npm run build`
- Lint/format clean: `cd functions && npm run check`
- Tests pass: `cd functions && npm run test`

Notes
- If you touch public types in `functions/src/**`, update corresponding tests.
- Do not rely on app-specific polyfills or libs unless declared in `functions/package.json`.
- Outbound mapper invariants (mapper-only `toIso`) primarily apply to `app/`; if shared utilities are imported, continue to avoid direct `.toISOString()`.
