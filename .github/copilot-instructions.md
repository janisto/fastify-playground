# Copilot Instructions

**GitHub** is used for version control and CI/CD workflows.  
This document defines how AI agents and contributors should work in our monorepo.

---

## Workflow Principles

- **Correctness first** → Prioritize correctness, then readability/maintainability, then performance. Optimize only when correctness and clarity are ensured.
- **Reflect before acting** → After receiving tool results, summarize insights, outline possible next steps, and pick the best one. Avoid rushing to execution.
- **Parallelize independent steps** → When multiple operations are unrelated, execute them in parallel to maximize efficiency.
- **No leftovers** → Clean up all temporary files, helper scripts, and debug outputs before finishing. Ensure `git status` is clean aside from intended changes.
- **Ask when unsure** → If requirements are ambiguous, seek clarification instead of making assumptions.
- **Well-supported dependencies** → Use only widely used, well-documented libraries with active maintenance.

---

## Coding Guidelines

- **Target**: TypeScript 5.9, Node.js 24.11.0 with ES2024 features. Use:
  - **Array methods**: `toSorted`, `toReversed`, `toSpliced`, `with`, `findLast`, `findLastIndex`
  - **Grouping**: `Object.groupBy`, `Map.groupBy`
  - **Set ops**: `union`, `intersection`, `difference`
  - **Iterator helpers**: `map`, `filter`, `flatMap`, `reduce`, `some`, `every`, `take`, `drop`, `toArray` (only where runtime supports them or a polyfill is configured; otherwise prefer array methods)
  - **Promises**: `Promise.withResolvers`
- **Imports**: Always use explicit imports. Avoid relying on Node.js globals without imports.
  - **ESM Import Extensions**: All relative imports **must** use `.js` extensions (e.g., `from "./utils.js"`, `from "../../plugins/jwt.js"`), not `.ts`. This is required because the project uses `"type": "module"` in package.json with NodeNext module resolution. TypeScript strips the `.js` extension during compilation.
  - **Biome enforcement**: The `useImportExtensions` rule with `forceJsExtensions: true` automatically checks and fixes missing `.js` extensions. Run `npm run check:fix` to auto-fix.
- **Globals policy**: Allow standard globals (`console`, timers, and Node 18+ `fetch` when `dom`/`webworker` libs are enabled); import types explicitly where needed.
- **Naming**: Use camelCase for variables/functions, PascalCase for classes/types.
- **Comments**: Add only when logic is non-trivial; avoid stating the obvious.
- **Types**: Use TypeScript types/interfaces for all data structures and function signatures.
  - Do not use inline `import("pkg").Type`.  
  - Always use `import type { … } from "pkg"`.
- **Avoid `any`**: Use `unknown` if type is uncertain. Prefer existing types over `Record<string, unknown>`.
- **Async code**: Use async/await. Wrap critical paths in try/catch and include contextual error messages.
- **Keep it simple**: Avoid over-engineering and premature abstractions. Write idiomatic, maintainable code.
- **Linting**: Do not use `eslint-disable`. Project enforces linting via Biome 2.3.3.
- **TypeScript/build targets**:
  - `app/tsconfig.json`: `target` `ES2024`, `module` `NodeNext`, `moduleResolution` `NodeNext`, extends `fastify-tsconfig`.
  - `app/tests/tsconfig.json`: Extends parent config with `rootDir: ".."` to allow test files outside src/, includes both src and test files.
- **Firestore indexes**: Do NOT add single-field composite indexes. When adding Firestore indexes, ensure `density` is set to `"SPARSE_ALL"` for all composite indexes in `firestore.indexes.json`. It is the only supported version in standard Firestore projects now.

---

## Unit Testing Guidelines

1. **Framework & Configuration**
   - **Test runner**: Vitest 4.0.6 with Node.js environment
   - **Globals enabled**: `describe`, `it`, `expect` are available without imports
   - **Coverage provider**: V8 with thresholds set to 70% (lines, functions, branches, statements)
   - **Test pattern**: `tests/**/*.test.ts`
   - **Timeouts**: 10 seconds for tests and hooks
   - Do not add inline Vitest env comments (e.g. `@vitest-environment node`).

2. **Coverage**
   - Write unit tests for all new features and bug fixes.  
   - **Minimum 70% coverage** enforced globally (lines, functions, branches, statements).
   - Aim for **90%+ coverage overall**, **100% for critical business logic**.  
   - Include tests for edge cases and error handling.
   - Enforce thresholds in CI; builds fail if coverage drops below thresholds.
   - Coverage excludes: test files, config files, entry points, and placeholder files.

3. **Structure**
   - Each source file has a matching test file.  
   - Integration tests mirror the same folder structure under `tests/integration/`.
   - Apply the same mirroring for `utils/`, `services/`, and `middleware/`.

4. **Folder conventions**
   - Unit tests → `tests/unit/`  
   - Integration tests → `tests/integration/`  
   - Mocks → `tests/mocks/`  
   - Helpers → `tests/helpers/`

5. **Test style**
   - Unit tests must not depend on real network, filesystem, or DB. Use mocks/stubs.  
   - Integration tests may touch real services when appropriate.
   - Prefer MSW (v2.11.6+) to stub HTTP; isolate external dependencies behind small adapters.
   - Mocks are automatically cleared, reset, and restored between tests.

6. **Type imports**
   - Do not use inline `import("pkg").Type`.  
   - Always use `import type { … } from "pkg"`.

---

## Monorepo Structure

This repository contains multiple apps:

- `./app/` → The main application (Node.js 24, ES2024, TypeScript).
- `./functions/` → Firebase Functions (Node.js 24, ES2024, TypeScript, serverless backend).

**Important:**  
- When working with the main application, always `cd app` before running commands like `npm run build` or `npm run test`.  
- When working with Firebase functions, use `cd functions`.  
- Do **not** assume project-level scripts from the repo root unless explicitly defined in `package.json`.
- Use npm consistently; do not use Yarn or pnpm for this repo.
- Each package.json must declare `engines.node` (app: 24, functions: 24) and provide an `.nvmrc`. CI should enforce Node versions via `nvm use`.

---

## OpenAPI Documentation Guidelines

- Use **OpenAPI 3.1** for all endpoints.  
- Include:
  - Request and response schemas
  - At least **one success example** and **one error example** per endpoint
  
---

## Secrets & environment variables
- Never commit secrets. Use environment files like `.env.local` (gitignored).
- Do not log secrets or PII; ensure logs redact sensitive fields.
- Document required env vars for integration tests and how to provide them locally and in CI.

---

## Useful CLI Commands

Before running any npm script, always confirm you're in the correct package directory. This monorepo has separate `app/` and `functions/` workspaces; scripts like `npm run lint`, `npm run test`, or `npm run build` must be executed inside the intended folder (unless a root script explicitly orchestrates both, which you must verify first). Use `pwd` to verify location, then `cd` if needed:

```
pwd  # expect path ending in /fastify-playground/app before app commands
cd app && npm run lint

pwd  # expect path ending in /fastify-playground/functions before functions commands
cd functions && npm run test
```

Never assume you're already in the right directory—always check with `pwd` first to avoid running the wrong toolchain or producing misleading build/test results.

| Command                           | Purpose                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `pwd`                             | Print the current working directory.                         |
| `cd app`                          | Change directory to the app folder.                          |
| `cd functions`                    | Change directory to the functions folder.                    |
| `npm run build`                   | Build the project.                                           |
| `npm run build:check`             | Validate build output.                                       |
| `npm run test`                    | Run unit tests.                                              |
| `npm run test:coverage`           | Run tests with coverage report.                              |
| `npm run check`                   | Run formatter, linter, and import sorting.                   |
| `npm run check:fix`               | Auto-fix formatting, lint, and imports.                      |
| `npm run lint`                    | Run linter.                                                  |
| `npm run lint:fix`                | Auto-fix lint issues.                                        |
| `npm run format`                  | Run code formatter.                                          |
| `npm run format:fix`              | Auto-fix formatting issues.                                  |

Always `cd` into the correct app directory before running commands (`cd app` or `cd functions`), unless using root-level scripts that orchestrate both.

---

## CI required checks
- App and Functions must each pass their own pipelines.
- Required checks per affected package:
   - Typecheck
   - Build
   - Unit tests (with coverage thresholds enforced)
   - Lint/format (`npm run check`)

## Biome Configuration (v2.3.3)

### Formatting Rules
- **Line width**: 150 characters
- **Format with errors**: Enabled (formats even if syntax errors exist)
- **EditorConfig integration**: Enabled (respects `.editorconfig` for indent style/size)
- **Quote style**: Double quotes
- **Semicolons**: Always required

### Linter Rules
- **Complexity**:
  - `noExcessiveCognitiveComplexity`: warn
  - `noForEach`: off
- **Correctness**:
  - `noUnusedImports`: error
  - `noUnusedVariables`: error
  - `useExhaustiveDependencies`: warn
  - `noUnusedFunctionParameters`: off
  - `useImportExtensions`: error (with `forceJsExtensions: true`)
- **Style**:
  - `noNonNullAssertion`: warn
  - `useConst`: error
  - `useTemplate`: error (prefer template literals)
  - `useImportType`: error (enforce `import type` for type imports)
  - `useFilenamingConvention`: off
  - `useNodejsImportProtocol`: error (enforce `node:` prefix for built-ins)
- **Suspicious**:
  - `noDebugger`: error
  - `noExplicitAny`: warn
- **Performance**:
  - `noAccumulatingSpread`: warn

### Important Notes
- Keep imports sorted/grouped per Biome; do not disable rules.
- The `useImportExtensions` rule with `forceJsExtensions: true` automatically enforces `.js` extensions on relative imports.
- Run `npm run check:fix` to auto-fix all linting and formatting issues.

---
