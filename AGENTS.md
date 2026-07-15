# AGENTS.md

Instructions for coding agents working in this repository.

`README.md` is for human users and contributors: setup, capabilities, architecture, operations, and contribution entry points. `AGENTS.md` is for coding agents: execution rules, implementation constraints, and validation policy. Do not duplicate agent instructions into the README or turn this file into human onboarding documentation.

## Engineering priorities

- Correctness first, then readability and maintainability, then performance.
- Inspect the existing code path and tests before changing behavior.
- Prefer small, explicit changes and existing local abstractions.
- State the failure mode before architectural, security, persistence, or production-impacting changes.
- Do not declare completion until implementation, validation, and remaining risks are reported.
- Keep source comments and documentation concise. Do not add progress narration, generated banners, emojis, or speculative TODOs.

## Repository layout

- `app/`: the active Fastify application.
- `app/src/modules/<name>/`: feature schemas, routes, services, and repositories or external clients.
- `app/src/plugins/`: infrastructure and cross-cutting Fastify plugins.
- `app/tests/`: unit and integration tests. Additional rules are in `app/tests/AGENTS.md`.
- `functions/`: placeholder only; it is not currently a Node.js package.
- `plans/`: durable implementation and migration logs.

Node.js 24.18.0 and pnpm 11.13.0 are required. The local runtime is pinned in `.node-version` and the package manager in `app/package.json`. Keep `@types/node` on the same major as the runtime: for Node 24 the allowed range is `^24.x`, currently `^24.13.3`; never upgrade it to Node 25 or 26 types without upgrading the runtime in the same change. Do not use npm or Yarn and do not add another lockfile. Automatic peer installation is disabled; declare every peer dependency the application actually uses.

Run package scripts from `app/`, or use the root `Justfile`:

```bash
just install
just qa
just check
just cov
just container-build
```

`just qa` applies safe Biome fixes before checking types and running tests. Use `just check` when a non-mutating validation run is required.

## TypeScript and modules

- TypeScript 7, strict mode, NodeNext ESM, and ES2024 are required.
- `app/tsconfig.json` extends the Fastify-maintained `fastify-tsconfig` baseline and adds project-specific strictness. Do not remove strict options to bypass errors.
- All relative ESM imports use `.js` extensions. Node.js built-ins use the `node:` protocol.
- Import types with `import type`; do not use inline `import("pkg").Type` expressions.
- Avoid `any`, non-null assertions, unchecked indexed access, parameter properties, and TypeScript-only runtime syntax.
- Model optional properties precisely. With `exactOptionalPropertyTypes`, omit an absent property instead of assigning `undefined`.
- Access index-signature values with bracket notation and guard array lookups.
- Use explicit imports instead of relying on Node.js globals where an import exists.

## Fastify architecture

- Keep `app/src/app.ts` as a side-effect-free application factory and `app/src/server.ts` as the only executable process and signal boundary.
- Install only SIGINT and SIGTERM shutdown handlers. Do not treat `uncaughtException` or `unhandledRejection` as asynchronously recoverable; do not call `process.exit()` during graceful cleanup.
- Register infrastructure and services once at plugin registration time, not per request.
- Wrap plugins that intentionally expose decorators with `fastify-plugin` and declare plugin names and dependencies.
- Expose feature APIs through `app/src/modules/<name>/index.ts`; import the index outside the module.
- Keep route handlers focused on HTTP concerns, services on business logic, and repositories or clients on persistence and external APIs.
- Use Fastify decorators for shared instance and request state. Extend Fastify types alongside each decorator.
- Use `fastify.inject()` for HTTP tests; do not open network ports in unit tests.

## Schemas and API contracts

- Define route schemas with `@fastify/type-provider-typebox` and `FastifyPluginAsyncTypebox`.
- Use standalone `typebox` and `typebox/value` for pre-Fastify environment decoding. Use `Value.Decode` so defaults, conversion, cleaning, and assertions run.
- Use OpenAPI 3.1 and give every public operation a stable, unique `operationId` plus summaries, descriptions, tags, request validation, and success and error responses.
- JSON API fields use camelCase.
- Declare implemented request and response formats with route `schema.consumes` and `schema.produces`; runtime negotiation and generated OpenAPI both depend on this metadata.
- Successful modeled responses use strict RFC 9110 negotiation. JSON is the default and tie preference; CBOR requires an explicit positive-quality `application/cbor` range; unsupported `Accept` values return 406 before parsing or handler execution. Do not gate 204 or 205 responses on `Accept`.
- Request bodies accept only the media types the route owns. The shared CBOR parser handles exact `application/cbor` with optional parameters; do not claim arbitrary `+cbor` suffixes.
- Errors use RFC 9457 `application/problem+json` by default or the same fields encoded as `application/cbor` when explicitly preferred. Do not use the unregistered `application/problem+cbor`; RFC 9290 concise CBOR problems are a different model and are not implemented.
- Negotiated responses include `Vary: Accept, Origin`.
- Pagination uses canonical unpadded Base64URL cursors, a 2,048-character maximum, and RFC 8288 `Link` headers. Previous links must return the preceding page without repeating the current page; link to the first page by omitting `cursor`.
- Shared response schemas have `$id` values. Response instances receive an RFC 8288 `Link` with `rel="describedBy"`; do not inject the JSON Schema `$schema` keyword into API data. Standalone `/schemas/*.json` documents declare Draft 2020-12 and rewrite component references into local `$defs`.

## Authentication, security, and logging

- Verify Firebase ID tokens with Firebase Admin SDK. Do not add application-managed JWT verification.
- The Firebase plugin exposes Authentication only. Reuse the default Firebase app when one exists and delete an app during shutdown only when this process initialized it. Do not reintroduce Firestore without an implemented feature and a cancellable lifecycle design.
- Never commit, log, or include credentials, tokens, authorization headers, cookies, or PII in fixtures.
- Use Application Default Credentials in production and emulators or `GOOGLE_APPLICATION_CREDENTIALS` locally.
- Validate `CORS_ORIGINS` at startup as exact HTTP(S) origins. The secure default is empty; never trust localhost implicitly, use wildcard origins with credentials, or turn a denied origin into a 5xx response.
- Parse bearer authorization as exactly `Bearer <non-whitespace-token>` (case-insensitive scheme). Reject extra fields or alternative whitespace before calling Firebase.
- `fastify-observability` owns the Pino instance, validated request IDs, W3C trace context, request correlation, response request-ID header, and the single terminal access record. Do not add parallel request-ID, request-context, trace-parsing, or access-log plugins.
- Keep the canonical Fastify constructor wiring: package-created `loggerInstance`, `requestIdHeader: false`, package `genReqId`, disabled Fastify request logging, and `requestIdLogLabel: "request_id"`. Register the package once at the root before other hooks and routes.
- Log through `fastify.log`, `request.log`, or `reply.log`, not `console`. Do not emit a second generic error record from the error handler; the terminal record already captures observed errors and final status.
- Do not repeat bound correlation names in per-call log objects. Application fields use snake_case, and domain diagnostics must add information beyond the terminal record.
- The GCP preset uses the validated bare W3C trace ID. Do not restore project-qualified trace resources, expose the incoming parent as a current span, claim span creation, or require a Google Cloud project ID for correlation.
- Keep production 5xx response details generic while retaining structured server-side terminal errors.
- Treat upstream response bodies and transport errors as untrusted. Preserve diagnostics in the error chain but expose controlled public details for upstream failures.
- Public GitHub proxy routes are deliberately unauthenticated upstream. `GITHUB_TOKEN` is only for opt-in tests that instantiate `GitHubClient` directly; the running application must never read or attach an ambient token to caller-selected owner or repository paths.
- Keep the application handler deadline at 15 seconds and GitHub's overall request deadline below it. Pass `request.signal` through routes and services, and validate every successful upstream payload before mapping it to the public schema.
- `/health` is a pressure-bypassed process liveness probe. `/status` is application-owned JSON readiness for shutdown and process pressure; do not globally gate it or unrelated routes on an optional external dependency.
- Keep the runtime container non-root and minimal. Do not add source maps or development dependencies without an operational need.

## Tests and coverage

- Use `.agents/skills/adversarial-testing` for every test change. State the highest-impact failure mode, test observable behavior and forbidden side effects, and ask which plausible mutation each test catches.
- Do not retest Fastify or third-party plugin APIs. Remove tests that only prove registration succeeds, a decorator exists, or a mock returns its configured value.
- Use Vitest with explicit imports; globals are disabled.
- Unit tests do not use real network, filesystem, Firebase, or other external services.
- Direct GitHub client integration tests are opt-in through the test-only `GITHUB_TOKEN` and skipped otherwise. Tests must prove the running application's GitHub path does not consume it.
- Cover success, validation, error, and boundary behavior for every change.
- Global V8 coverage thresholds are 90% for lines, functions, branches, and statements across `src/**/*.ts`.
- Coverage exceptions require a narrow `/* v8 ignore ... -- @preserve */` comment and a genuinely untestable boundary.

## Biome

Biome 2.5.3 is the formatter and linter. The root configuration enables recommended project, test, and type-aware domains plus strict correctness, security, promise, and import rules.

- Do not add suppression comments to avoid fixing actionable diagnostics.
- `pnpm check:fix` applies safe fixes only. Review unsafe suggestions individually.
- Keep imports organized and all diagnostics at zero.
- The entropy-based `noSecrets` rule is intentionally not enabled because it produced false positives on public identifiers and fixtures; secret prevention remains a contributor and platform scanning responsibility.

## Completion checklist

For changes affecting the application, run the narrowest relevant test first, then:

```bash
just check
pnpm --dir app build
```

Run `just container-build` when package installation, build output, runtime startup, or Docker configuration changes. Update `README.md`, this file, test guidance, and the relevant plan log when commands or contracts change.
