# AGENTS.md

Use these rules for tests under `app/tests/` (Node 24, TypeScript, Vitest).

## Test Structure

- **Unit tests** - `app/tests/unit/**` (mirror `app/src/**` structure)
  - `unit/plugins/**` - Plugin tests (accepts-serializer, auth, cbor-parser, cors, error-handler, firebase, helmet, lifecycle, logging, requestid, schema-discovery, schema-registry, sensible, swagger, under-pressure, vary-header)
  - `unit/routes/**` - Route tests (health, schemas, v1)
  - `unit/modules/**` - Module tests (hello/routes, hello/service, items/routes, items/service)
  - `unit/schemas/**` - Schema tests (index)
  - `unit/utils/**` - Utility tests (cbor, link-header, pagination, schema-error-formatter, schema-url)
  - `unit/env.test.ts` - Environment configuration tests
- **Integration tests** - `app/tests/integration/**` (full-stack API tests)
- **Mocks** - `app/tests/mocks/**` (Firebase mocks, test utilities)
- **Helpers** - `app/tests/helpers/**` (shared test utilities)

## Test Framework (Vitest)

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
- **MSW for HTTP mocking**: Available but use judiciously; prefer small adapters
- **Each source file has a matching test file**: Mirror directory structure in `tests/unit/`
- **Import extensions required**: All relative imports must use `.js` extensions (e.g., `import foo from "../../../src/plugins/cors.js"`)
- **Type imports**: Use explicit `import type { ... } from "pkg"` (enforced by Biome's `useImportType` rule)
- **Module imports**: When a test consumes a module as a unit, prefer `src/modules/<name>/index.ts` instead of deep imports.
- **No inline Vitest env comments**: Do not add `// @vitest-environment node` comments (repository rules prohibit them)
- **Realistic fixtures**: Use realistic data; avoid PII
- **Parse JSON responses**: Use `response.json()` to parse JSON responses in assertions

### Plugin Tests

- Test plugin registration and functionality
- Use `Fastify()` instance and register plugin via `fastify.register(plugin)`
- Wrap plugins with `fastify-plugin` (`fp`) to expose decorators to parent scope
- Test decorators by registering the plugin and verifying decorated properties exist
- Test hooks and middleware behavior
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

### Firebase Admin SDK Mocking

Use the shared Firebase mocks from `tests/mocks/firebase.ts` for all Firebase-related tests.

#### Mock Setup Pattern

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock, createFirestoreMock } from "../../mocks/firebase.js";

// Create mock instances
const mockApp = createFirebaseAppMock();
const mockAuth = createFirebaseAuthMock();
const mockFirestore = createFirestoreMock();

// Mock firebase-admin modules before importing plugins
vi.mock("firebase-admin/app", () => ({
	getApps: vi.fn(() => [mockApp]),
	initializeApp: vi.fn(() => mockApp),
	cert: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
	getAuth: vi.fn(() => mockAuth),
}));

vi.mock("firebase-admin/firestore", () => ({
	getFirestore: vi.fn(() => mockFirestore),
}));

describe("Firebase Plugin", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(async () => {
		vi.resetModules();
	});

	it("should register firebase decorator", async () => {
		const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
		const fastify = Fastify();
		await fastify.register(firebasePlugin);
		await fastify.ready();

		expect(fastify.firebase).toBeDefined();
		await fastify.close();
	});
});
```

#### Available Mock Helpers

```typescript
// tests/mocks/firebase.ts provides:
createFirebaseAppMock()    // Mock Firebase App instance
createFirebaseAuthMock()   // Mock Firebase Auth with verifyIdToken, getUser, etc.
createFirestoreMock()      // Mock Firestore with collection, doc, get, etc.
resetFirebaseMocks()       // Reset all mocks between tests
```

#### Testing Auth with Mocked Tokens

```typescript
it("should authenticate with valid token", async () => {
	const mockDecodedToken = {
		uid: "test-user-123",
		email: "test@example.com",
		email_verified: true,
	};
	mockAuth.verifyIdToken.mockResolvedValue(mockDecodedToken);

	// ... register plugins and test route
	const response = await fastify.inject({
		method: "GET",
		url: "/protected",
		headers: { authorization: "Bearer valid-token" },
	});

	expect(response.statusCode).toBe(200);
	// Note: verifyIdToken is called with (token, checkRevoked) where checkRevoked defaults to false
	expect(mockAuth.verifyIdToken).toHaveBeenCalledWith("valid-token", false);
});
```

#### Testing Token Revocation

```typescript
it("should return 401 when token is revoked", async () => {
	const revokedError = Object.assign(new Error("Token has been revoked"), {
		code: "auth/id-token-revoked",
	});
	mockAuth.verifyIdToken.mockRejectedValue(revokedError);

	// Register auth plugin with checkRevoked: true
	await fastify.register(authPlugin, { checkRevoked: true });

	const response = await fastify.inject({
		method: "GET",
		url: "/protected",
		headers: { authorization: "Bearer revoked-token" },
	});

	expect(response.statusCode).toBe(401);
	expect(response.json().message).toContain("Token has been revoked");
});
```

### Decorator Testing Patterns

Test Fastify decorators by registering the plugin and verifying decorated properties exist.

#### Instance Decorator Testing

```typescript
it("should decorate fastify with isShuttingDown", async () => {
	const fastify = Fastify();
	await fastify.register(lifecycle);
	await fastify.ready();

	expect(fastify.isShuttingDown).toBeDefined();
	expect(fastify.isShuttingDown).toBe(false);

	await fastify.close();
});
```

#### Request Decorator Testing

```typescript
it("should decorate request with user property", async () => {
	const fastify = Fastify();
	await fastify.register(sensiblePlugin);
	await fastify.register(firebasePlugin);
	await fastify.register(authPlugin);

	mockAuth.verifyIdToken.mockResolvedValue({ uid: "test-user" });

	fastify.get("/test", { preHandler: [fastify.authenticate] }, async (request) => {
		return { userId: request.user?.uid };
	});

	const response = await fastify.inject({
		method: "GET",
		url: "/test",
		headers: { authorization: "Bearer valid-token" },
	});

	expect(response.json()).toEqual({ userId: "test-user" });
	await fastify.close();
});
```

### TypeBox Schema Testing

When testing routes that use TypeBox schemas, verify response shapes match the schema. Routes use `FastifyPluginAsyncTypebox` for automatic type inference.

```typescript
import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";

it("should return response matching TypeBox schema", async () => {
	const fastify = Fastify();
	await fastify.register(healthRoute);

	const response = await fastify.inject({
		method: "GET",
		url: "/health",
	});

	expect(response.statusCode).toBe(200);
	const body = response.json();

	// Verify structure matches Type.Object({ status: Type.Literal("healthy") })
	expect(body).toHaveProperty("status", "healthy");

	await fastify.close();
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

## Test Suite Structure

**Test files organized by type:**

- `env.test.ts` - Environment configuration validation with TypeBox
- `plugins/accepts-serializer.test.ts` - CBOR response serialization
- `plugins/auth.test.ts` - Firebase Auth, token verification, request.user decorator, checkRevoked option
- `plugins/cbor-parser.test.ts` - CBOR request body parsing
- `plugins/cors.test.ts` - CORS origin validation, preflight requests
- `plugins/error-handler.test.ts` - Error logging, RFC 9457 responses, validation errors
- `plugins/firebase.test.ts` - Firebase Admin SDK initialization, decorators
- `plugins/helmet.test.ts` - Security headers, CSP, HSTS
- `plugins/lifecycle.test.ts` - onReady, onListen, onClose hooks, isShuttingDown decorator
- `plugins/logging.test.ts` - Request/response logging with timing
- `plugins/requestid.test.ts` - Request ID generation, header propagation
- `plugins/schema-discovery.test.ts` - Schema link header injection
- `plugins/schema-registry.test.ts` - Shared TypeBox schema registration
- `plugins/sensible.test.ts` - HTTP errors, assertions, error utilities
- `plugins/swagger.test.ts` - JSON/YAML endpoints, Swagger UI, OpenAPI schema
- `plugins/under-pressure.test.ts` - Health checks, /status endpoint, Firestore connectivity, timeout handling
- `plugins/vary-header.test.ts` - Vary: Accept header for caching
- `routes/health.test.ts` - Health check endpoint (returns `{ status: "healthy" }`)
- `routes/schemas.test.ts` - Schema discovery endpoint
- `routes/v1.test.ts` - V1 API router registration (hello, items modules)
- `modules/hello/routes.test.ts` - Hello endpoint with name parameter
- `modules/hello/service.test.ts` - Hello service unit tests
- `modules/items/routes.test.ts` - Items collection with pagination and filtering
- `modules/items/service.test.ts` - Items service unit tests
- `schemas/index.test.ts` - Shared schema exports
- `utils/cbor.test.ts` - CBOR utility functions
- `utils/link-header.test.ts` - Link header utilities
- `utils/pagination.test.ts` - Pagination utilities
- `utils/schema-error-formatter.test.ts` - Schema error formatting
- `utils/schema-url.test.ts` - Schema URL utilities
- `integration/app.test.ts` - Full application stack tests with Firebase mocks
