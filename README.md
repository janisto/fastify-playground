# fastify-playground

A production-ready REST API built with Fastify, TypeScript, and modern tooling for Node.js 24. Features comprehensive OpenAPI documentation, JWT authentication, structured logging, and graceful shutdown.

## Tech Stack

- **Runtime**: Node.js 24 (ES2024)
- **Framework**: Fastify 5.x with TypeScript 5.9
- **Testing**: Vitest 4.x with V8 coverage provider (70% minimum thresholds)
- **Code Quality**: Biome 2.x (formatting, linting, import organization)
- **Backend Services**: Firebase Admin SDK (configured for future integration)
- **Package Manager**: npm
- **Module System**: ESM (`"type": "module"`)

## Project Structure

```
.
├── app/                    # Main Fastify application
│   ├── src/
│   │   ├── app.ts         # Application entry point
│   │   ├── plugins/       # Fastify plugins
│   │   └── routes/        # Route handlers
│   ├── tests/
│   │   ├── unit/          # Unit tests (plugins/, routes/)
│   │   ├── integration/   # Integration tests (app.test.ts)
│   │   ├── mocks/         # Test mocks (placeholder)
│   │   └── helpers/       # Test utilities (placeholder)
│   ├── package.json
│   ├── tsconfig.json      # TypeScript config (ES2024, NodeNext)
│   ├── vitest.config.ts   # Vitest config with coverage
│   └── biome.json         # App-specific Biome overrides
├── functions/             # Firebase Cloud Functions (placeholder, not implemented)
├── biome.json             # Root Biome configuration
└── .nvmrc                 # Node version
```

## Features

### Core
- **Fastify 5.x** with plugin architecture and `@fastify/autoload` (forceESM mode)
- **TypeScript 5.9** with strict mode
- **ES2024 target** (modern JavaScript features: `toSorted`, `Object.groupBy`, Set ops, Iterator helpers)
- **ESM-first** (`"type": "module"` with NodeNext module resolution)
- **Auto-loading** routes and plugins via `@fastify/autoload` with `forceESM: true`

### Documentation & API
- **OpenAPI 3.1.0** specification via `@fastify/swagger`
- **Swagger UI** (`@fastify/swagger-ui`) for interactive API documentation
- **Automated schema generation** from route definitions
- **Health check endpoint** with OpenAPI documentation
- **Multiple export formats** (JSON, YAML, interactive UI)

### Security & Middleware
- **Helmet** (`@fastify/helmet`) for security headers
- **CORS** (`@fastify/cors`) with configurable origin validation
- **JWT Authentication** (`@fastify/jwt`) with HS256, 1-hour expiration, environment-based secrets
- **Sensible** (`@fastify/sensible`) plugin for common utilities and HTTP errors
- **Global error handler** with structured error responses and proper logging
- **Request context** (`@fastify/request-context`) for request-scoped data

### Observability & Operations
- **Structured logging** with automatic request ID generation (UUID v4)
- **Request/response logging** with timing, user-agent, and IP tracking
- **Request ID propagation** via `X-Request-Id` header (client-provided or auto-generated)
- **Lifecycle hooks** for initialization, startup, and shutdown events
- **Graceful shutdown** handling SIGTERM/SIGINT with cleanup hooks
- **Child loggers** with request context for distributed tracing

### Development
- **Hot reload** with tsx watch mode
- **Vitest** for testing with 70% minimum coverage requirement
- **Biome** for fast formatting and linting
- **EditorConfig** support (2-space indentation, LF line endings)
- **MSW** available for HTTP mocking in tests (not currently used)
- **Firebase Emulator** support for local development

### Code Quality & Standards
- **Strict unused imports/variables** detection and auto-removal
- **Import extensions** enforced (`.js` for relative imports via `useImportExtensions`)
- **Node.js protocol** enforced (`node:` prefix for built-ins)
- **Type-only imports** enforced (`import type` syntax)
- **Template literals** preferred over string concatenation
- **No debugger** statements in production
- **Explicit `any`** warnings
- **Double quotes** and **semicolons** enforced

## Key Dependencies

### Production (`app/package.json`)
- **fastify** - Fast and low overhead web framework
- **@fastify/autoload** - Plugin auto-loading
- **@fastify/cors** - CORS middleware
- **@fastify/helmet** - Security headers
- **@fastify/jwt** - JWT authentication
- **@fastify/request-context** - Request-scoped context
- **@fastify/sensible** - Common utilities and HTTP errors
- **@fastify/swagger** - OpenAPI documentation generation
- **@fastify/swagger-ui** - Swagger UI integration
- **fastify-cli** - CLI utilities for Fastify
- **firebase-admin** - Firebase Admin SDK
- **undici** - HTTP/1.1 client (used by Fastify)

### Development (`app/package.json`)
- **@biomejs/biome** - Fast formatter and linter
- **@types/node** - Node.js type definitions
- **@vitest/coverage-v8** - V8 coverage provider for Vitest
- **fastify-tsconfig** - Shared TypeScript config for Fastify
- **msw** - HTTP mocking for tests
- **tsx** - TypeScript execution with hot reload
- **typescript** - TypeScript compiler
- **vitest** - Testing framework

## Getting Started

### Prerequisites

- Node.js 24 (use `nvm use` to switch to the correct version from `.nvmrc`)
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/janisto/fastify-playground.git
cd fastify-playground

# Switch to Node 24 (uses .nvmrc)
nvm use

# Install dependencies
cd app
npm install
```

### Development

```bash
cd app

# Start development server with hot reload (tsx watch mode)
npm run dev

# Run tests once
npm test

# Run tests with coverage report
npm run test:coverage

# Watch mode for tests (interactive)
npm run test:watch

# Type check without compilation
npm run build:check

# Run all checks (format, lint, imports)
npm run check

# Auto-fix all issues (format, lint, imports)
npm run check:fix
```

## Scripts

All commands should be run from the `app/` directory. Use `pwd` to verify you're in the correct directory before running commands.

| Command                 | Description                                           |
|-------------------------|-------------------------------------------------------|
| `npm run dev`           | Start development server with hot reload (tsx watch)  |
| `npm run serve`         | Start Firebase emulators (App Hosting, Firestore)     |
| `npm start`             | Run compiled application (node dist/app.js)           |
| `npm run deploy`        | Deploy to Firebase App Hosting                        |
| `npm run build`         | Compile TypeScript to JavaScript (dist/)              |
| `npm run build:watch`   | Compile TypeScript in watch mode                      |
| `npm run build:check`   | Type check without emitting files                     |
| `npm test`              | Run all tests once (unit + integration)               |
| `npm run test:watch`    | Run tests in watch mode (interactive)                 |
| `npm run test:coverage` | Run unit tests with coverage report (70% threshold)   |
| `npm run check`         | Run all checks (format, lint, imports)                |
| `npm run check:fix`     | Auto-fix all issues (format, lint, imports)           |
| `npm run lint`          | Run linter only                                       |
| `npm run lint:fix`      | Auto-fix linting issues only                          |
| `npm run format`        | Check formatting only                                 |
| `npm run format:fix`    | Auto-fix formatting issues only                       |

## Configuration

### TypeScript (`app/tsconfig.json`)
- **Target**: ES2024
- **Module**: NodeNext (ESM with Node.js resolution)
- **Extends**: `fastify-tsconfig` for Fastify-specific settings
- **Strict mode**: Enabled
- **Root dir**: `src/`
- **Output**: `dist/`
- **Library**: ES2024
- **Types**: Node.js only (no DOM)

**Test Configuration** (`app/tests/tsconfig.json`):
- Extends parent config with `rootDir: ".."` to allow test files outside src/
- Includes both `src/**/*.ts` and test files
- Adds `vitest/globals` types for test globals

**Important**: All relative imports must use `.js` extensions (e.g., `import { foo } from "./utils.js"`) because the project uses `"type": "module"` in package.json. TypeScript automatically strips these extensions during compilation. Biome's `useImportExtensions` rule enforces this and auto-fixes missing extensions.

### Vitest (`app/vitest.config.ts`)
- **Environment**: Node.js
- **Globals**: Enabled (`describe`, `it`, `expect` available without imports)
- **Coverage provider**: V8
- **Coverage thresholds**: 70% minimum (lines, functions, branches, statements) - enforced globally
- **Auto-clear mocks**: Mocks cleared, reset, and restored between tests
- **Timeouts**: 10 seconds for tests and hooks
- **Test pattern**: `tests/**/*.test.ts`
- **Reporters**: text, json, json-summary, html, lcov
- **Coverage scope**: Only `tests/unit/` - integration tests don't affect coverage metrics
- **Exclusions**: node_modules, dist, coverage, test files, config files, entry point (`app.ts` tested via integration)
- **V8 ignore comments**: Use `/* v8 ignore next -- @preserve */` before statements to exclude from coverage (e.g., signal handlers, unreachable code)

### Biome (`biome.json`)
- **Line width**: 150 characters
- **EditorConfig integration**: Enabled (respects `.editorconfig`)
- **Quote style**: Double quotes
- **Semicolons**: Always required
- **Format with errors**: Enabled
- **Unused code**: Strict detection (imports, variables) - auto-fixable
- **Import extensions**: Enforced (`.js` for relative imports) - auto-fixable
- **Node.js protocol**: Enforced (`node:` prefix) - auto-fixable
- **Type imports**: Enforced (`import type` syntax) - auto-fixable
- **Template literals**: Preferred over concatenation
- **Globals**: console, process, Buffer, timers

### EditorConfig (`.editorconfig`)
- **Charset**: UTF-8
- **Line endings**: LF (Unix-style)
- **Indentation**: 2 spaces
- **Trim trailing whitespace**: Yes (except Markdown)
- **Insert final newline**: Yes

## Project Structure Details

### Available Plugins (`app/src/plugins/`)

All plugins are automatically loaded via `@fastify/autoload` with `forceESM: true`. Each plugin is wrapped with `fastify-plugin` to expose decorators globally.

#### Security & Middleware
- **`cors.ts`** - CORS configuration with configurable origin validation (defaults to localhost in development)
- **`helmet.ts`** - Security headers via `@fastify/helmet` v13 (CSP, HSTS, X-Frame-Options, etc.)
- **`jwt.ts`** - JWT authentication with HS256, 1-hour expiration, environment-based secrets, decorators for sign/verify/decode
- **`sensible.ts`** - Common utilities via `@fastify/sensible` (HTTP errors, assertions, error utilities)

#### Observability
- **`error-handler.ts`** - Global error handler with structured responses, proper logging, validation error handling, stack traces in development
- **`request-logging.ts`** - Request/response logging with automatic request ID generation (UUID v4), context storage, timing calculation, header propagation
- **`lifecycle.ts`** - Application lifecycle hooks (onReady, onListen, onClose) with graceful shutdown handling (SIGTERM/SIGINT)

#### Documentation
- **`swagger.ts`** - OpenAPI 3.1.0 documentation generation with Swagger UI, JSON/YAML export endpoints

### Available Routes (`app/src/routes/`)

All routes are automatically loaded via `@fastify/autoload` with `forceESM: true`.

- **`health.ts`** - Health check endpoint (`GET /health`) with OpenAPI schema, returns `{ status: "healthy" }`
- **`root.ts`** - Root endpoint (`GET /`) with basic response

### Auto-loading Pattern

The app uses `@fastify/autoload` with `forceESM: true` to automatically load:
1. **Plugins** from `src/plugins/` (support plugins loaded first)
2. **Routes** from `src/routes/` (route handlers loaded second)

This enables a clean, modular plugin architecture:
- Add new plugin → create file in `src/plugins/` → automatically loaded
- Add new route → create file in `src/routes/` → automatically loaded
- No manual registration required
- Consistent loading order (plugins before routes)

## Testing

The project enforces high test coverage standards with comprehensive test suite:

- **Framework**: Vitest with V8 coverage provider
- **Minimum coverage**: 70% across all metrics (lines, functions, branches, statements) - enforced globally
- **Test structure**: Separate directories for unit, integration, mocks, and helpers
- **Mock management**: Automatic clearing, resetting, and restoration between tests
- **Globals**: Vitest globals enabled (`describe`, `it`, `expect`, etc.) - no imports needed
- **HTTP mocking**: MSW available for stubbing external HTTP calls (not currently used)
- **Isolation**: Tests run in isolated environments with 10-second timeouts
- **Fastify testing**: Uses `fastify.inject()` for HTTP request simulation without network

### Test Suite Structure

#### Unit Tests (`tests/unit/`)
- **`plugins/cors.test.ts`** - CORS origin validation, preflight requests, allowed methods
- **`plugins/helmet.test.ts`** - Security headers, CSP, HSTS, X-Frame-Options
- **`plugins/jwt.test.ts`** - Sign, verify, decode, expiration, invalid tokens, decorators
- **`plugins/sensible.test.ts`** - HTTP errors, assertions, error utilities, status codes
- **`plugins/swagger.test.ts`** - JSON/YAML endpoints, Swagger UI, OpenAPI schema
- **`plugins/error-handler.test.ts`** - Error logging, structured responses, validation errors, stack traces
- **`plugins/request-logging.test.ts`** - Request ID generation, header propagation, context storage, response logging
- **`plugins/lifecycle.test.ts`** - onReady, onListen, onClose hooks, graceful shutdown
- **`routes/health.test.ts`** - Health check endpoint returns `{ status: "healthy" }`
- **`routes/root.test.ts`** - Root endpoint returns `{ root: true }`

#### Integration Tests (`tests/integration/`)
- **`app.test.ts`** - Full application stack with all plugins, route loading, error handling

### Test Organization

Write tests in `app/tests/` following this structure:

- **`unit/`** - Unit tests for plugins and routes (one test file per source file)
  - `plugins/` - Plugin-specific tests
  - `routes/` - Route-specific tests
- **`integration/`** - Full-stack integration tests
- **`mocks/`** - Shared mock data and utilities (placeholder with `.gitkeep`)
- **`helpers/`** - Test helper functions and utilities (placeholder with `.gitkeep`)

### Coverage Notes

- Coverage is measured **only on unit tests** (`tests/unit/`)
- Integration tests (`tests/integration/`) validate full-stack behavior but don't affect coverage metrics
- Use `/* v8 ignore next -- @preserve */` before statements to exclude from coverage (e.g., signal handlers, unreachable error paths)
- Coverage reports generated in `coverage/` with HTML, LCOV, JSON formats
- CI enforces 70% threshold - builds fail if coverage drops below

## Environment Variables

The application uses the following environment variables:

| Variable       | Required | Default                                  | Description                                    |
|---------------|----------|------------------------------------------|------------------------------------------------|
| `JWT_SECRET`  | No       | `development-secret-change-in-production` | Secret key for JWT signing/verification. **Must be set in production!** A warning is logged in development if using default. |
| `NODE_ENV`    | No       | (none)                                   | Environment mode (`test`, `development`, `production`) |
| `PORT`        | No       | `3000`                                   | Server port (typically set by hosting platform like Cloud Run/App Hosting) |
| `HOST`        | No       | `0.0.0.0`                                | Server host address (bind to all interfaces in production) |
| `LOG_LEVEL`   | No       | `info`                                   | Logging verbosity (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |

**Important**: Never commit secrets. Use `.env.local` (gitignored) for local development and proper secrets management in production.

## Firebase Integration

The project integrates with Firebase services:

- **Firebase Admin SDK** - Backend SDK for Firestore, Auth, Cloud Storage
- **Firebase App Hosting** - Deployment target for the Fastify application
- **Firebase Emulators** - Local development environment

### Firebase Scripts
- `npm run serve` - Start Firebase emulators (App Hosting + Firestore)
- `npm run deploy` - Deploy to Firebase App Hosting

The Firebase Admin SDK is installed as a dependency but not actively used in the current implementation. The project is configured for future integration with Firebase services (Firestore, Authentication, etc.).

## API Documentation

Once the server is running, access the interactive API documentation:

- **Swagger UI**: http://localhost:3000/documentation
- **OpenAPI JSON**: http://localhost:3000/documentation/json
- **OpenAPI YAML**: http://localhost:3000/documentation/yaml

The OpenAPI 3.1.0 specification includes:
- Request/response schemas with validation rules
- Success and error examples
- Authentication requirements (JWT Bearer)
- Detailed endpoint descriptions with HTTP methods
- Automatic schema generation from route definitions

## CI/CD & Automation

### GitHub Actions Workflows

The project includes comprehensive CI/CD automation in `.github/workflows/`:

- **`ci-app.yml`** - App pipeline (triggered on `app/**` changes):
  - Node.js 24 setup with npm cache
  - Dependency installation (`npm ci`)
  - TypeScript build check (`npm run build:check`)
  - Unit tests with coverage (`npm run test:coverage`)
  - Coverage report generation (via `vitest-coverage-report-action`)
  - Artifact upload for coverage reports

- **`lint-app.yml`** - Linting checks for app code (Biome CI)
- **`labeler.yml`** - Automatic PR labeling (on pull_request_target)
- **`labeler-manual.yml`** - Manual PR labeling workflow (workflow_dispatch)

### Deployment

Firebase App Hosting deployment is automated via:
```bash
npm run deploy  # Deploy to Firebase App Hosting
```

Local testing with emulators:
```bash
npm run serve  # Start Firebase emulators (App Hosting, Firestore)
```

### Logging in Cloud Run / Firebase App Hosting

The application uses **Pino** (Fastify's default logger) with Cloud Logging integration optimized for Google Cloud environments.

#### Configuration

Logging is configured in `app/src/app.ts` with Cloud Run / Firebase App Hosting compatibility:

```typescript
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    
    // Cloud Logging optimized defaults:
    // ✓ JSON format (automatic in Pino)
    // ✓ stdout output (automatic in Pino)
    // ✓ No file transport needed
    
    formatters: {
      level: (label) => {
        // Maps Pino levels to Cloud Logging severity
        return { severity: label.toUpperCase() };
      },
    },
  },
});
```

#### Severity Level Mapping

Pino levels are automatically mapped to Cloud Logging severity:

| Pino Level | Cloud Logging Severity | Use Case |
|------------|------------------------|----------|
| `fatal`    | `FATAL`                | Fatal errors requiring immediate attention |
| `error`    | `ERROR`                | Error events (400-500 errors, exceptions) |
| `warn`     | `WARNING`              | Warning events (potential issues) |
| `info`     | `INFO`                 | Informational messages (requests, responses) |
| `debug`    | `DEBUG`                | Debug information |
| `trace`    | `DEBUG`                | Detailed trace information |

#### Structured Logging Features

1. **Automatic Request ID**: Every request gets a UUID v4 request ID
   - Client-provided via `X-Request-Id` header, or auto-generated
   - Propagated to all child loggers for request correlation
   - Included in all log entries for distributed tracing

2. **Request/Response Logging**: Automatic logging with:
   - HTTP method, URL, status code
   - Response time (milliseconds)
   - User-agent and client IP
   - Request ID for correlation

3. **Error Logging**: Structured error information:
   - Error message and stack traces (development only)
   - Validation errors with detailed field information
   - HTTP status codes and error types

4. **Lifecycle Events**: Server state changes:
   - Server initialization and ready state
   - Server listening with address and port
   - Graceful shutdown progress

#### Viewing Logs

**Firebase App Hosting:**
```bash
# View logs in Firebase console
firebase apphosting:logs --project your-project-id

# Or use the web console
# https://console.firebase.google.com/project/your-project-id/apphosting
```

**Cloud Run (if self-hosting):**
```bash
# View logs via gcloud CLI
gcloud run services logs read SERVICE_NAME --project your-project-id

# Or use Cloud Logging in GCP console
# https://console.cloud.google.com/logs
```

#### Log Level Configuration

Set the `LOG_LEVEL` environment variable to control verbosity:

```bash
# Development - verbose logging
LOG_LEVEL=debug

# Production - standard logging (default)
LOG_LEVEL=info

# Production - minimal logging
LOG_LEVEL=warn
```

In Firebase App Hosting, set environment variables via:
```bash
firebase apphosting:secrets:set LOG_LEVEL --project your-project-id
```

#### Best Practices

- **Production**: Use `LOG_LEVEL=info` (default) for balanced observability
- **Debugging**: Use `LOG_LEVEL=debug` temporarily to diagnose issues
- **Performance**: Logs are automatically batched and sent asynchronously
- **Request Correlation**: Always use request ID from context for related logs
- **Sensitive Data**: Never log passwords, tokens, or PII - logs are redacted automatically

#### Example Log Entry

```json
{
  "level": 30,
  "time": 1699027200000,
  "pid": 1,
  "hostname": "instance-001",
  "severity": "INFO",
  "reqId": "req-1",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "url": "/api/users",
  "statusCode": 200,
  "responseTime": 42.5,
  "userAgent": "Mozilla/5.0...",
  "ip": "203.0.113.1",
  "msg": "Request completed"
}
```

## Fastify-Specific Patterns

### Plugin Architecture
- All plugins use `fastify-plugin` wrapper for global decorator exposure
- Plugins loaded before routes via `@fastify/autoload`
- `forceESM: true` ensures proper ESM module loading
- Each plugin is self-contained with JSDoc documentation

### Request Lifecycle
1. **onRequest** → Request ID generation, context setup
2. **preHandler** → JWT verification (if required)
3. **handler** → Route logic execution
4. **onResponse** → Response logging with timing
5. **onError** → Global error handler with structured responses

### Decorators
- **`fastify.jwt.sign(payload)`** - Sign JWT tokens
- **`fastify.jwt.verify(token)`** - Verify JWT tokens  
- **`fastify.jwt.decode(token)`** - Decode JWT tokens
- **`fastify.authenticate`** - Authentication decorator for protecting routes (use in `onRequest` hook)
- **`request.id`** - Request ID (auto-generated UUID v4)
- **`request.log`** - Child logger with request context
- **HTTP error helpers** from `@fastify/sensible` (e.g., `reply.notFound()`, `reply.badRequest()`)

### Testing Patterns
```typescript
import { describe, it, expect } from "vitest";
import Fastify from "fastify";

describe("Plugin Name", () => {
  it("should do something", async () => {
    const fastify = Fastify();
    await fastify.register(yourPlugin);
    await fastify.ready();
    
    const response = await fastify.inject({
      method: "GET",
      url: "/endpoint"
    });
    
    expect(response.statusCode).toBe(200);
    await fastify.close();
  });
});
```

### Error Handling
- Global error handler returns structured JSON responses
- 4xx errors logged as warnings
- 5xx errors logged as errors with full context
- Validation errors return 422 with detailed field errors
- Stack traces included only in non-production environments

### Graceful Shutdown
- SIGTERM/SIGINT handlers registered via lifecycle plugin
- `fastify.close()` waits for in-flight requests to complete
- onClose hooks for cleanup (database connections, caches)
- Process exits with code 0 on success, 1 on error

## Important Gotchas

### ESM Import Extensions
**CRITICAL**: All relative imports must use `.js` extensions (not `.ts`):
```typescript
// ✅ Correct
import { foo } from "./utils.js";
import { bar } from "../../plugins/jwt.js";

// ❌ Wrong - will fail at runtime
import { foo } from "./utils";
import { bar } from "../../plugins/jwt.ts";
```

This is enforced by:
- Biome's `useImportExtensions` rule with `forceJsExtensions: true`
- TypeScript's NodeNext module resolution with `"type": "module"`
- Run `npm run check:fix` to auto-fix missing extensions

### Node.js Protocol Prefix
Built-in Node.js modules must use `node:` prefix:
```typescript
// ✅ Correct
import * as path from "node:path";
import { randomUUID } from "node:crypto";

// ❌ Wrong
import * as path from "path";
```

Enforced by Biome's `useNodejsImportProtocol` rule (auto-fixable).

### Type-Only Imports
Use `import type` for type imports:
```typescript
// ✅ Correct
import type { FastifyInstance, FastifyRequest } from "fastify";

// ❌ Wrong
import { FastifyInstance, FastifyRequest } from "fastify";

// ❌ Never use inline imports
const handler = (req: import("fastify").FastifyRequest) => {};
```

Enforced by Biome's `useImportType` rule (auto-fixable).

### V8 Coverage Ignore
Use V8 ignore comments with `@preserve` to prevent esbuild from stripping them:
```typescript
/* v8 ignore next -- @preserve */
process.on("SIGTERM", () => gracefulShutdown());

/* v8 ignore next -- @preserve */
function unreachableErrorPath() {
  // This code is never executed in tests
}
```

For blocks of code, use start/stop (also with `@preserve`):
```typescript
/* v8 ignore start -- @preserve */
// Multiple statements to ignore
const handler = setupHandler();
process.on("SIGINT", handler);
/* v8 ignore stop -- @preserve */
```

### Test Coverage Scope
- Only **unit tests** (`tests/unit/`) affect coverage metrics
- Integration tests (`tests/integration/`) validate behavior but don't count toward coverage
- Entry point `app.ts` excluded from coverage (tested via integration)

## License

MIT

## Author

Jani Mikkonen
