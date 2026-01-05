# fastify-playground

A production-ready REST API built with Fastify, TypeScript, and modern tooling for Node.js 24. Features comprehensive OpenAPI documentation, Firebase Authentication, TypeBox schema validation, structured logging, and graceful shutdown.

<img src="assets/ts.svg" alt="TypeScript logo" width="200">

<sub>TypeScript logo from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Typescript_logo_2020.svg)</sub>

## Features

- Layered plugin architecture with security headers (Helmet), CORS, request IDs, and structured access logs
- Request-scoped Pino logger with Google Cloud Trace correlation via [W3C Trace Context](https://www.w3.org/TR/trace-context/) `traceparent` header, falling back to request ID when no trace exists
- Firebase Authentication with ID token verification and `request.user` decorator
- TypeBox schema validation with compile-time TypeScript types and runtime JSON Schema validation
- [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457) for all error responses with optional field-level validation errors
- Content negotiation supporting [JSON (RFC 8259)](https://datatracker.ietf.org/doc/html/rfc8259) and [CBOR (RFC 8949)](https://datatracker.ietf.org/doc/html/rfc8949) formats via `Accept` header
- Cursor-based pagination with [RFC 8288 Link](https://datatracker.ietf.org/doc/html/rfc8288) headers
- [OpenAPI 3.1.0](https://spec.openapis.org/oas/v3.1.0) documentation with Swagger UI, auto-generated from TypeBox route schemas
- Graceful shutdown handling SIGTERM/SIGINT with `isShuttingDown` decorator
- Health check endpoints (`/health` for liveness, `/status` for readiness with Firestore connectivity)

## API Design Principles

### URI Design

- Lowercase letters with hyphens for multi-word segments: `/api/user-profiles`
- Plural nouns for collections: `/items`, `/users`
- Path parameters for resource identifiers: `/items/{id}`
- Query parameters for filtering, sorting, and pagination: `/items?category=electronics&limit=20`

### HTTP Methods

| Method | Purpose | Idempotent | Success Status |
|--------|---------|------------|----------------|
| GET | Retrieve resource(s) | Yes | 200 OK |
| POST | Create resource | No | 201 Created |
| PUT | Replace resource | Yes | 200 OK / 204 No Content |
| PATCH | Partial update | No | 200 OK |
| DELETE | Remove resource | Yes | 204 No Content |

### Error Responses (RFC 9457)

All errors use [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457):

```json
{
  "type": "https://example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more fields failed validation",
  "instance": "/items",
  "errors": [
    { "field": "name", "message": "is required" }
  ]
}
```

Content-Type: `application/problem+json` or `application/problem+cbor`

### Content Negotiation

| Accept Header | Response Format |
|---------------|-----------------|
| `application/json` | JSON (default) |
| `application/cbor` | CBOR binary |
| `*/*` or missing | JSON (default) |

All responses include `Vary: Accept` header for proper caching.

### Pagination

Collections use cursor-based pagination with [RFC 8288 Link](https://datatracker.ietf.org/doc/html/rfc8288) headers:

```
GET /items?limit=20&cursor=aXRlbToxMjM

Link: </items?limit=20&cursor=aXRlbToxNTY>; rel="next"
```

- `cursor` - Opaque Base64URL-encoded cursor (do not decode on client)
- `limit` - Items per page (1-100, default 20)

### Request Identification

- Client-provided `X-Request-Id` header used if valid (printable ASCII, max 128 chars)
- Server generates UUID v4 otherwise
- Response includes `X-Request-Id` header
- All logs include request ID for correlation

## Project Structure

```
app/
  src/
    app.ts              # Application entry point
    env.ts              # Environment validation (TypeBox)
    plugins/            # Fastify plugins (16 plugins, layered architecture)
    routes/             # Route handlers (health, schemas)
    modules/            # Feature modules (hello/, items/)
      <name>/           # index.ts, routes.ts, schemas.ts, service.ts
    schemas/            # Shared TypeBox schemas (problem-details, pagination)
    utils/              # Utility functions
  tests/
    unit/               # Unit tests (mirror src/ structure)
    integration/        # Full-stack integration tests
    mocks/              # Test mocks (firebase.ts)
functions/              # Firebase Cloud Functions (placeholder)
```

## Quick Start

```bash
# Prerequisites: Node.js 24 (use fnm use)
git clone https://github.com/janisto/fastify-playground.git
cd fastify-playground/app
fnm use && npm install
npm run dev  # Start development server with hot reload
```

Access the API at http://localhost:3000 and Swagger UI at http://localhost:3000/api-docs

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js 24 (ES2024) |
| Framework | Fastify 5.x with TypeScript 5.9 |
| Authentication | Firebase Admin SDK |
| Schema Validation | TypeBox with @fastify/type-provider-typebox |
| Testing | Vitest with V8 coverage (70% minimum) |
| Code Quality | Biome (formatting, linting, imports) |
| Backend Services | Firebase (Auth, Firestore) |
| Module System | ESM (`"type": "module"`) |

## Development Commands

Run all commands from the `app/` directory:

```bash
npm run fix           # Auto-fix all issues (format, lint, type check, tests)
npm run dev           # Start dev server with hot reload
npm test              # Run all tests
npm run test:coverage # Run tests with coverage report
npm run check         # Run format, lint, and import checks
npm run check:fix     # Auto-fix all issues
npm run build:check   # Type check without compilation
npm run serve         # Start Firebase emulators
npm run deploy        # Deploy to Firebase App Hosting
```

## Container

```bash
just container-build      # Build image
just container-up         # Run container detached
just container-down       # Stop container
```

Or with Docker/Podman CLI:

```bash
docker build -t fastify-playground:latest ./app
docker run --rm -p 8080:8080 --env-file .env fastify-playground:latest
```

## Deployment

### Google Cloud Run

```bash
# Build and push to Artifact Registry
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/REPO/fastify-playground:latest ./app

# Deploy with automatic base image updates
gcloud run deploy fastify-playground \
  --image REGION-docker.pkg.dev/PROJECT_ID/REPO/fastify-playground:latest \
  --platform managed \
  --region REGION \
  --base-image nodejs24 \
  --automatic-updates

# Deploy from source with automatic base image updates
gcloud run deploy fastify-playground \
  --source . \
  --platform managed \
  --region REGION \
  --base-image nodejs24 \
  --automatic-updates
```

The `--base-image` and `--automatic-updates` flags enable [automatic base image updates](https://cloud.google.com/run/docs/configuring/services/automatic-base-image-updates), allowing Google to apply security patches to the OS and runtime without rebuilding or redeploying.

Set `FIREBASE_PROJECT_ID` environment variable to enable trace correlation in Cloud Logging.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe (`{ status: "healthy" }`) |
| GET | `/status` | Readiness check with Firestore connectivity |
| GET | `/v1/hello` | Greeting endpoint |
| POST | `/v1/hello` | Personalized greeting (201 Created) |
| GET | `/v1/items` | Items with cursor-based pagination and category filtering |
| GET | `/schemas/:schemaId` | Schema discovery |
| GET | `/api-docs` | Swagger UI |
| GET | `/api-docs/json` | OpenAPI 3.1.0 spec (JSON) |

## Environment Variables

Copy `.env.example` to `.env` and customize as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `LOG_LEVEL` | `info` | Logging level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `FIREBASE_PROJECT_ID` | - | Firebase Project ID (primary source for Cloud Trace correlation) |
| `GOOGLE_CLOUD_PROJECT` | - | Google Cloud Project ID for Cloud Trace |
| `SECRET_MANAGER_ENABLED` | `false` | Enable Secret Manager integration |
| `APP_ENVIRONMENT` | `development` | Application environment label (`development`, `staging`, `production`) |
| `APP_URL` | `http://localhost:3000` | Base URL for the application |

**Firebase Emulators**:

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (dev only) |
| `FIRESTORE_EMULATOR_HOST` | Firestore emulator address (e.g., `localhost:8080`) |
| `FIREBASE_AUTH_EMULATOR_HOST` | Auth emulator address (e.g., `localhost:9099`) |

## Plugin Architecture

Plugins are registered explicitly in `app.ts` with layered dependencies:

| Layer | Plugins |
|-------|---------|
| 1. Core | sensible, helmet, cors |
| 2. Content Negotiation | cbor-parser, accepts-serializer, vary-header |
| 3. Infrastructure | firebase, lifecycle, under-pressure, swagger |
| 4. Application | auth, error-handler, requestid, logging |
| 5. Response Transformation | schema-registry, schema-discovery |

All plugins use `fastify-plugin` wrapper to expose decorators globally.

## Firebase Authentication

```typescript
// Protect routes with the authenticate decorator
fastify.get(
  "/protected",
  { preHandler: [fastify.authenticate] },
  async (request) => {
    return { userId: request.user.uid };
  },
);
```

Clients send Firebase ID tokens via `Authorization: Bearer <token>` header.

## Testing

- **Framework**: Vitest with V8 coverage
- **Coverage threshold**: 70% (lines, functions, branches, statements)
- **Unit tests**: `tests/unit/` (affects coverage)
- **Integration tests**: `tests/integration/` (validates behavior, no coverage impact)

## Code Style Requirements

All enforced by Biome and auto-fixable with `npm run check:fix`:

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

- **app-ci.yml**: Build check, tests, coverage report
- **app-lint.yml**: Biome linting
- **labeler.yml**: Automatic PR labeling

## Contributing

See [AGENTS.md](AGENTS.md) for coding guidelines and conventions.

## License

MIT
