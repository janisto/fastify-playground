# fastify-playground

[![Application CI](https://img.shields.io/github/actions/workflow/status/janisto/fastify-playground/app-ci.yml?branch=main&label=application%20CI&logo=githubactions&logoColor=white)](https://github.com/janisto/fastify-playground/actions/workflows/app-ci.yml)
[![Code quality](https://img.shields.io/github/actions/workflow/status/janisto/fastify-playground/app-lint.yml?branch=main&label=code%20quality&logo=biome&logoColor=white)](https://github.com/janisto/fastify-playground/actions/workflows/app-lint.yml)
[![Node.js 24.18.0](https://img.shields.io/badge/Node.js-24.18.0-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![pnpm 11.13.0](https://img.shields.io/badge/pnpm-11.13.0-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![MIT license](https://img.shields.io/github/license/janisto/fastify-playground)](LICENSE)

A production-oriented reference REST API built with Fastify, TypeScript, and Node.js 24. It demonstrates OpenAPI documentation, Firebase Authentication, TypeBox validation, structured logging, strict content negotiation, and deterministic shutdown.

<img src="assets/ts.svg" alt="TypeScript logo" width="200">

<sub>TypeScript logo from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Typescript_logo_2020.svg)</sub>

## Features

- Layered plugin architecture with production HSTS, an exact CORS origin allowlist, and [fastify-observability](https://www.npmjs.com/package/fastify-observability)
- Validated request IDs, strict [W3C Trace Context](https://www.w3.org/TR/trace-context/), request-scoped Pino fields, and exactly one structured terminal access record
- Firebase Authentication with ID token verification, a `request.user` decorator, and a protected `/v1/auth/me` example
- TypeBox schema validation with compile-time TypeScript types and runtime JSON Schema validation
- [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457) for application-owned error responses with optional field-level validation errors
- Content negotiation supporting [JSON (RFC 8259)](https://datatracker.ietf.org/doc/html/rfc8259) and [CBOR (RFC 8949)](https://datatracker.ietf.org/doc/html/rfc8949) formats via `Accept` header
- Cursor-based pagination with [RFC 8288 Link](https://datatracker.ietf.org/doc/html/rfc8288) headers
- [OpenAPI 3.1.0](https://spec.openapis.org/oas/v3.1.0) documentation with Swagger UI, auto-generated from TypeBox route schemas
- Graceful SIGTERM/SIGINT shutdown owned by the executable server boundary; fatal Node.js errors are not treated as recoverable application events
- Health check endpoints (`/health` for process liveness and `/status` for shutdown/load readiness)

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

Application-owned errors, including `/status` failures, use [RFC 9457 Problem Details](https://datatracker.ietf.org/doc/html/rfc9457). Documentation routes retain their Fastify plugin-owned error formats.

```json
{
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more fields failed validation",
  "errors": [
    { "location": "body.name", "message": "is required" }
  ]
}
```

Responses include `Link: </schemas/ErrorModel.json>; rel="describedBy"` for schema discovery. Error bodies use
`application/problem+json` by default, or the same fields encoded as registered `application/cbor` when the client
explicitly prefers CBOR.

### Content Negotiation

API responses with a body default to JSON. CBOR is selected only by an explicit, positive-quality
`Accept: application/cbor`; wildcards and equal quality values keep JSON. RFC 9110 quality values and specificity are
honored, including exact `q=0` exclusions. JSON-family ranges may include `charset=utf-8`; unsupported media
parameters remain non-matching. If an explicit `Accept` value excludes every supported success representation, the API
returns 406 before parsing the request body or running the handler. A 204 or 205 response has no representation, so
`Accept` does not gate it.

| Response class | Media types | Policy |
|----------------|-------------|--------|
| `/v1` success | `application/json`, `application/cbor` | Strict negotiation; JSON is the default and tie preference |
| `/health` | `application/json` | Strict JSON-only liveness response |
| `/status` | `application/json` | Strict JSON-only readiness response; unavailable responses use negotiated Problem Details |
| `/schemas/*.json` | `application/schema+json` | Strict JSON Schema representation |
| Problem Details | `application/problem+json`, `application/cbor` | Best effort; explicit CBOR preference wins, otherwise JSON preserves the original error status |
| `/api-docs` assets | Fastify-owned JSON, YAML, HTML, CSS, or JavaScript | Fixed formats outside application negotiation |

JSON and CBOR request bodies are selected independently with `Content-Type`. Modeled request bodies accept
`application/json` and `application/cbor`, with media-type parameters ignored. Unowned structured suffixes such as
`application/vnd.example+cbor` and the unregistered `application/problem+cbor` are rejected with 415. RFC 9290's
registered `application/concise-problem-details+cbor` uses a different compact data model and is not implemented.

Negotiated responses include `Vary: Accept, Origin`. Successful modeled responses and Problem Details use an RFC 8288
`Link` header for schema discovery. Response instances do not contain the JSON Schema `$schema` keyword; standalone
schema documents include the Draft 2020-12 dialect and local `$defs` for referenced components.

### Pagination

Collections use cursor-based pagination with [RFC 8288 Link](https://datatracker.ietf.org/doc/html/rfc8288) headers:

```
GET /items?limit=20&cursor=aXRlbToxMjM

Link: </items?limit=20&cursor=aXRlbToxNTY>; rel="next"
```

- `cursor` - Canonical, unpadded Base64URL cursor with a 2,048-character limit (do not decode on client)
- `limit` - Items per page (1-100, default 20)

Malformed, noncanonical, empty, oversized, invalid UTF-8, wrong-resource, and stale cursors return a client error. A previous-page link returns the exact preceding page; the second page links back to the first page without an empty `cursor` parameter.

### Request Identification

- Client-provided `X-Request-Id` is accepted only when it contains 1–128 URI-unreserved ASCII characters (`A-Z`, `a-z`, `0-9`, `-`, `.`, `_`, or `~`)
- Missing, empty, duplicate, oversized, or invalid values are replaced with a generated request ID
- Response includes `X-Request-Id` header
- `request.id`, `request.observability.requestId`, and the Pino `request_id` binding always agree

### Observability

[fastify-observability](https://www.npmjs.com/package/fastify-observability) owns the application Pino logger, request-ID generation, W3C trace parsing, request correlation, and access logging. It emits one terminal `request completed` record for successful, handled-error, unhandled-error, timeout, and observable abort paths. Query strings, request bodies, cookies, authorization, and arbitrary headers are not selected for access records.

The GCP preset maps log levels to Cloud Logging severity and emits the validated bare trace ID in `logging.googleapis.com/trace`. It does not prepend a project resource, copy the incoming parent ID into a fake current-span field, initialize a cloud SDK, or create spans. Without a valid `traceparent`, `correlation_id` falls back to the request ID.

Application code logs through `fastify.log`, `request.log`, or `reply.log`. Request-scoped logs inherit `request_id`, `correlation_id`, and validated trace fields. The immutable context is also available as `request.observability`.

## Project Structure

```
.agents/skills/           Portable coding-agent workflows
app/
  src/
    app.ts              # Pure application factory
    server.ts           # Executable startup and signal boundary
    env.ts              # Environment validation (TypeBox)
    plugins/            # Application-owned Fastify plugins
    routes/             # Route handlers (health, schemas)
    modules/            # Feature modules (auth/, github/, hello/, items/)
      <name>/           # index.ts, routes.ts, schemas.ts, service.ts
    schemas/            # Shared TypeBox schemas (problem-details, pagination)
    utils/              # Utility functions
  tests/
    unit/               # Unit tests (mirror src/ structure)
    integration/        # Full-stack integration tests
    mocks/              # Test mocks (firebase.ts)
functions/              # Firebase Cloud Functions (placeholder)
```

## Requirements

- Node.js 24.18.0 (pinned in `.node-version`), managed with [fnm](https://github.com/Schniz/fnm): `brew install fnm`
- pnpm 11.13.0 through Corepack
- [just](https://github.com/casey/just) for repository workflows
- Firebase project with Authentication, or the Authentication emulator, only when exercising `/v1/auth/me`

## Quick Start

```bash
git clone https://github.com/janisto/fastify-playground.git
cd fastify-playground
fnm use && corepack enable
cp .env.example .env
just install
just serve
```

Access the API at http://localhost:3000 and Swagger UI at http://localhost:3000/api-docs

The root `Justfile` loads `.env` for its recipes. Direct runtime commands such as `pnpm dev` and `pnpm start` consume variables already exported by your shell.

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js 24.18.0 (ES2024) |
| Framework | Fastify 5.x with TypeScript 7 |
| Observability | fastify-observability with Pino 10 |
| Package manager | pnpm 11.13.0 |
| Authentication | Firebase Admin SDK |
| Schema Validation | TypeBox with @fastify/type-provider-typebox |
| Testing | Vitest with V8 coverage (90% minimum) |
| Code Quality | Biome (formatting, linting, imports) |
| Backend Services | Firebase Authentication |
| Module System | ESM (`"type": "module"`) |

## Development Commands

Use the root `Justfile` for normal development:

```bash
just lint             # Check Biome formatting and lint rules
just typing           # Type-check source and tests
just test             # Run unit and integration tests
just cov              # Run the full suite with coverage
just qa               # Apply safe fixes, then type-check and test
just check            # Run all non-mutating quality gates
just install          # Install exactly from the lockfile
just update           # Update dependencies within declared ranges
```

Direct package scripts run from `app/`:

```bash
pnpm qa            # Auto-fix lint/format, type check, and run tests
pnpm dev           # Start dev server with hot reload
pnpm test          # Run all tests
pnpm test:coverage # Run tests with coverage report
pnpm check         # Run format, lint, and import checks
pnpm check:fix     # Auto-fix all issues
pnpm typecheck     # Type check source and tests
pnpm start         # Start the compiled server
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

# Deploy the checked-in complete container image
gcloud run deploy fastify-playground \
  --image REGION-docker.pkg.dev/PROJECT_ID/REPO/fastify-playground:latest \
  --platform managed \
  --region REGION \
  --allow-unauthenticated
```

This repository builds a complete distroless application image. Cloud Run's [automatic base-image updates](https://docs.cloud.google.com/run/docs/configuring/services/automatic-base-image-updates) apply to services deployed from a scratch application image or compatible source/buildpacks flow, not to this image. Rebuild and redeploy the checked-in image to pick up Node.js or distroless security updates. The runtime remains non-root and does not enable source maps because the image does not ship source files and no source-map-dependent operational workflow is configured.

Trace correlation requires only a valid incoming W3C `traceparent`; no Google Cloud project setting is needed for the package's bare trace-ID contract.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe (`{ status: "healthy" }`) |
| GET | `/status` | Readiness probe (`{ status: "ready" }`); returns 503 while shutting down or under excessive process load |
| GET | `/v1/auth/me` | Minimal identity from a verified Firebase ID token |
| GET | `/v1/hello` | Greeting endpoint |
| POST | `/v1/hello` | Personalized greeting (201 Created) |
| GET | `/v1/items` | Items with cursor-based pagination and category filtering |
| GET | `/v1/github/owners/:owner` | GitHub user profile |
| GET | `/v1/github/owners/:owner/repos` | List user repositories |
| GET | `/v1/github/repos/:owner/:repo` | Repository details |
| GET | `/v1/github/repos/:owner/:repo/activity` | Repository activity (paginated) |
| GET | `/v1/github/repos/:owner/:repo/languages` | Repository languages |
| GET | `/v1/github/repos/:owner/:repo/tags` | Repository tags |
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
| `LOG_LEVEL` | `info` | Logging level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`) |
| `CORS_ORIGINS` | empty | JSON array or comma-separated exact browser origins; empty denies all browser origins |

Firebase Authentication configuration:

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Local path used directly by Application Default Credentials; the application does not read the key file |
| `FIREBASE_AUTH_EMULATOR_HOST` | Auth emulator address (e.g., `localhost:9099`) |

The **API `GITHUB_TOKEN`** in `.env.example` is test-only. It raises the limit for opt-in tests that instantiate `GitHubClient` directly; the running API deliberately does not decode or forward it. Prefer a fine-grained token without private-repository access. It is separate from the **Merge `GITHUB_TOKEN`**, GitHub Actions' automatic token for repository workflows.

## Plugin Architecture

Plugins are registered explicitly in `app.ts` with layered dependencies:

| Layer | Plugins |
|-------|---------|
| 1. Observability | fastify-observability |
| 2. Core | sensible, helmet, cors |
| 3. HTTP Lifecycle | vary-header, cbor-parser, content-negotiation |
| 4. Infrastructure | Firebase Auth, lifecycle, Swagger, process-pressure protection |
| 5. Application | auth, error-handler |
| 6. Response Metadata | schema-registry, schema-discovery |
| 7. Routes | health, schemas, v1 modules |

Observability is registered once at the root before every application hook and route. Application-owned plugins use `fastify-plugin` when decorators or hooks must escape encapsulation.

## Firebase Authentication

```bash
curl \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer FIREBASE_ID_TOKEN' \
  http://localhost:3000/v1/auth/me
```

The response contains only `{ "userId": "..." }`; claims such as email addresses are not reflected. Missing, malformed, invalid, or expired credentials return a controlled 401 Problem Details response, while Firebase configuration or provider failures return 503. The example uses Firebase's default `checkRevoked: false`; enable revocation checks only when immediate session invalidation is part of the product contract and the extra lookup is acceptable.

## GitHub Proxy Boundary

The `/v1/github` examples proxy public GitHub REST data without a server credential. This is intentional: attaching a broad deployment token to caller-selected owner and repository paths could expose private resources available to that token. Each upstream request has a 10-second overall deadline beneath the application's 15-second handler deadline, propagates request cancellation, validates the successful GitHub payload, and maps upstream failures to controlled Problem Details.

GitHub's [unauthenticated primary rate limit](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) is 60 requests per hour per source IP. The example has no cache or distributed inbound rate limiter. A production public proxy that needs more capacity should define a different authorization boundary and add cache and distributed abuse controls rather than putting a private-capable token behind these caller-selected routes.

## Testing

- **Framework**: Vitest with V8 coverage
- **Coverage threshold**: 90% (lines, functions, branches, statements)
- **Coverage scope**: Full unit and integration suite across all `src/**/*.ts` files
- **Unit tests**: `tests/unit/` with mocked external dependencies
- **Integration tests**: `tests/integration/`; direct real-GitHub client tests require the API `GITHUB_TOKEN` and otherwise skip

## Code Style Requirements

Biome enforces formatting, imports, project and test rules, and type-aware promise and correctness checks. TypeScript separately checks production and test code with exact optional properties and unchecked indexed access. `pnpm check:fix` applies safe fixes; `just check` runs all non-mutating quality gates.

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Description |
|----------|-------------|
| `app-ci.yml` | Pinned-runtime build, tests, coverage, production image build, probe smoke, and graceful-shutdown smoke |
| `app-lint.yml` | Code quality (Biome) |
| `labeler.yml` | Automatic PR labeling |
| `labeler-manual.yml` | Manual labeling for historical PRs |
| `dependabot-auto-merge.yml` | Auto-merge Dependabot minor/patch updates |

Dependabot is configured in `.github/dependabot.yml` for automated dependency updates. The auto-merge workflow intentionally maps the Merge `GITHUB_TOKEN`, exposed as `${{ secrets.GITHUB_TOKEN }}`, to `GH_TOKEN` for GitHub CLI authentication; contributors do not need to configure that secret. Workflow actions intentionally use explicit release tags such as `actions/checkout@v7.0.0`, rather than full commit SHAs, so Dependabot can propose readable version updates.

## Contributing

The README is the human-facing project guide. Portable coding-agent workflows live under [`.agents/skills/`](.agents/skills/), and agent execution rules live in [AGENTS.md](AGENTS.md).

## License

MIT
