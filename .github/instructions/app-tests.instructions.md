---
applyTo: "app/tests/**"
---

Use these rules for tests under `app/tests/**` (Node 24, TS 5.9, Vitest 4.0.6).

## Test Structure

- **Unit tests** → `app/tests/unit/**` (mirror `app/src/**` structure)
  - `unit/plugins/**` - Plugin tests (cors, helmet, jwt, lifecycle, error-handler, request-logging, sensible, swagger)
  - `unit/routes/**` - Route tests (health, root)
- **Integration tests** → `app/tests/integration/**` (full-stack API tests)
- **Mocks** → `app/tests/mocks/**` (MSW 2.11.6+ for HTTP mocking, currently unused but available)
- **Helpers** → `app/tests/helpers/**` (shared test utilities)

## Test Framework (Vitest 4.0.6)

### Configuration (`app/vitest.config.ts`)
- **Environment**: Node.js
- **Globals enabled**: `describe`, `it`, `expect` available without imports
- **Coverage provider**: V8
- **Test pattern**: `tests/**/*.test.ts`
- **Timeouts**: 10 seconds for tests and hooks
- **Isolation**: Enabled (tests run in isolation)
- **Mock behavior**: Auto-clear, reset, and restore between tests

### Coverage Requirements
- **Provider**: V8 (fast, accurate with AST-aware remapping since Vitest 3.2)
- **Minimum thresholds**: 70% (lines, functions, branches, statements) - enforced globally
- **Target**: Aim for 90%+ overall, 100% for critical business logic
- **Scope**: Only `tests/unit/**` affects coverage metrics (integration tests validate behavior but don't count toward coverage)
- **Exclusions**: `node_modules`, `dist`, `coverage`, test files, config files, entry point (`app.ts` tested via integration)
- **Reporters**: text, json, json-summary, html, lcov

### V8 Coverage Ignore
Use `/* v8 ignore next -- @preserve */` to exclude statements from coverage:

```typescript
// Ignore single statement
/* v8 ignore next -- @preserve */
process.on("SIGTERM", () => gracefulShutdown());

// Ignore function
/* v8 ignore next -- @preserve */
function unreachableErrorPath() {
  // ...
}

// Ignore block (use start/stop for multiple statements)
/* v8 ignore start -- @preserve */
const handler = setupHandler();
process.on("SIGINT", handler);
/* v8 ignore stop -- @preserve */
```

**Important**: The `-- @preserve` suffix is required to prevent esbuild from stripping comments during TypeScript compilation.

## Testing Conventions

### General Rules
- **No real external dependencies in unit tests**: Mock network calls, filesystem, databases
- **MSW for HTTP mocking**: Available (v2.11.6+) but use judiciously; prefer small adapters
- **Each source file has a matching test file**: Mirror directory structure in `tests/unit/`
- **Import extensions required**: All relative imports must use `.js` extensions (e.g., `import foo from "../../../src/plugins/cors.js"`)
- **Type imports**: Use explicit `import type { ... } from "pkg"` (enforced by Biome's `useImportType` rule)
- **No inline Vitest env comments**: Do not add `// @vitest-environment node` comments (repository rules prohibit them)
- **Realistic fixtures**: Use realistic data; avoid PII

### Plugin Tests
- Test plugin registration and functionality
- Use `Fastify()` instance and register plugin via `fastify.register(plugin)`
- Test decorators, hooks, and middleware behavior
- Verify integration with other plugins where applicable
- Call `await fastify.ready()` before testing
- Always `await fastify.close()` after tests

Example:
```typescript
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import cors from "../../../src/plugins/cors.js";

describe("CORS Plugin", () => {
  it("should register CORS plugin", async () => {
    const fastify = Fastify();
    await fastify.register(cors);
    await fastify.ready();
    // Test expectations
    await fastify.close();
  });
});
```

### Route Tests
- Test all HTTP methods and status codes
- Test validation errors (query params, body, headers)
- Test success cases with expected response shapes
- Test authentication/authorization where applicable
- Use `fastify.inject()` for HTTP request simulation
- Verify OpenAPI schema compliance (status codes, response shapes)

Example:
```typescript
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import health from "../../../src/routes/health.js";

describe("GET /health", () => {
  it("should return healthy status", async () => {
    const fastify = Fastify();
    await fastify.register(health);

    const response = await fastify.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(response.payload)).toEqual({ status: "healthy" });

    await fastify.close();
  });
});
```

### Integration Tests
- Test full application stack (`app.ts` with all plugins and routes)
- Validate end-to-end behavior
- Test authentication flows, error handling, request/response logging
- Do not affect coverage metrics (coverage measured only on unit tests)

## Run Commands

**From repository root**, always `cd app` first:

```bash
cd app

# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run unit tests with coverage report
npm run test:coverage
```

## Quality Gates

Before committing, ensure all checks pass:

```bash
cd app

# 1. TypeScript compilation
npm run build

# 2. Linting and formatting
npm run check        # Check for issues
npm run check:fix    # Auto-fix issues

# 3. Tests
npm run test         # All tests
npm run test:coverage # With coverage report
```

## Writing Effective Tests

1. **Cover all code paths**: Success, errors, edge cases, validation failures
2. **Test contracts, not implementation**: Focus on public API behavior
3. **Use descriptive test names**: Clearly state what is being tested and expected outcome
4. **Keep tests focused**: One assertion concept per test
5. **Avoid test interdependencies**: Each test should be independent and isolated
6. **Mock external dependencies**: No real network, filesystem, or database calls in unit tests
7. **Verify error messages and types**: Don't just check status codes
8. **Test async code properly**: Always `await` promises and async operations

## Coverage Best Practices

- **Unit tests only**: Coverage metrics come from `tests/unit/**`
- **Integration tests**: Validate behavior but don't count toward coverage
- **Exclude untestable code**: Use `/* v8 ignore next -- @preserve */` for signal handlers, unreachable error paths
- **Monitor coverage trends**: Aim to increase coverage over time, never decrease
- **100% for critical paths**: Authentication, authorization, data validation, error handling
- **CI enforcement**: Builds fail if coverage drops below 70% threshold

## Current Test Suite

**73 tests across 11 test files:**

- `plugins/cors.test.ts` - 6 tests
- `plugins/helmet.test.ts` - 6 tests
- `plugins/jwt.test.ts` - 14 tests
- `plugins/sensible.test.ts` - 18 tests
- `plugins/error-handler.test.ts` - 7 tests
- `plugins/request-logging.test.ts` - 6 tests
- `plugins/lifecycle.test.ts` - 5 tests
- `plugins/swagger.test.ts` - 4 tests
- `routes/health.test.ts` - 1 test
- `routes/root.test.ts` - 1 test
- `integration/app.test.ts` - 5 tests
