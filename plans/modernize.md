# Modernization Log

## Goal

Modernize this undeployed public example without preserving backward compatibility. Record completed work, validation, and remaining risks as the modernization proceeds.

## 2026-07-14: npm to pnpm migration

### Scope

- Replace npm lockfiles and package-manager metadata with pnpm equivalents.
- Pin the pnpm version used by contributors, CI, and container builds.
- Migrate package scripts, CI, Docker, editor tooling, and executable documentation.
- Keep dependency versions unchanged except where pnpm resolves an existing declared range differently.
- Validate frozen installation, static checks, build, tests, coverage, and the production container.

### Baseline

- Active Node.js package: `app/`.
- Placeholder package directory: `functions/` (no `package.json`).
- Runtime: Node.js 24 from `.node-version`.
- Package manager: npm with `app/package-lock.json`.
- Additional untracked root `package-lock.json` contains no dependencies.
- CI and Docker use npm clean installs.

### Progress

- [x] Inventory package manifests, lockfiles, scripts, CI, Docker, editor configuration, and documentation.
- [x] Confirm the current pnpm registry release: 11.13.0.
- [x] Pin pnpm in the application manifest.
- [x] Generate `app/pnpm-lock.yaml`; remove npm lockfiles.
- [x] Migrate package scripts and repository guidance.
- [x] Migrate CI, Docker, and editor tooling.
- [x] Verify no active npm or npx commands remain.
- [x] Run a frozen install and all app quality gates.
- [x] Build and start the production container.

### Decisions

- Keep the lockfile and pnpm policy configuration in `app/`, matching the repository's package-local workflow and Docker build context. A root workspace would add structure without a second package.
- Keep Dependabot's `package-ecosystem: "npm"` value because GitHub uses that identifier for npm-compatible JavaScript ecosystems, including pnpm.
- Use `pnpm install --frozen-lockfile` for reproducible CI and container installs.
- Allow only the required `@firebase/util` and `esbuild` lifecycle scripts. Explicitly deny the unused `msw` worker-copy script and the informational `protobufjs` script.
- Declare `fastify-plugin` 6.0.0 as a runtime dependency and `openapi-types` as a development dependency. npm's hoisted tree previously masked both undeclared direct imports; pnpm's isolated layout exposed them during the container build.
- Use `pnpm/action-setup` 6.0.9, the current release at migration time.

### Validation Log

- `pnpm install --frozen-lockfile`: passed; lockfile and supply-chain policies verified.
- `pnpm ignored-builds`: no automatically ignored builds; `msw` and `protobufjs` are explicitly denied.
- `pnpm check`: passed with one pre-existing optional-chain warning in `src/plugins/logging.ts`.
- `pnpm build:check`: passed.
- `pnpm test`: 34 test files passed, 1 skipped; 354 tests passed, 7 skipped.
- `pnpm test:coverage`: 100% statements, 98.88% branches, 100% functions, and 100% lines.
- `just container-build fastify-playground:modernize`: passed with frozen development and production installs.
- Production image startup: passed. `/health` returned 503 because the container had no Firestore credentials or emulator; logs confirmed the application initialized and listened on port 8080 before the health gate rejected the request.

### Remaining Follow-up

- Run an authenticated container health smoke against Firestore or the emulator when that environment is available.

## 2026-07-14: Just lifecycle recipes

- [x] Add `just install` as a frozen pnpm install for `app/`.
- [x] Add `just update` as a pnpm dependency refresh for `app/` within the declared version ranges.
- [x] Validate recipe discovery, dry runs, and frozen installation.

Validation: `just --fmt --check`, both recipe dry runs, and `just install` passed. `just update` was not executed because validation should not change dependency versions.

## 2026-07-14: Full Justfile alignment

- [x] Align recipe ordering and groups with the FastAPI playground.
- [x] Add Fastify-specific test, quality, run, and lifecycle recipes.
- [x] Preserve the existing container interface and pnpm dependency behavior.
- [x] Validate formatting, discovery, command expansion, and non-mutating recipes.

Validation: `just --fmt --check`, `just --list`, all recipe dry runs, `just install`, and `just check` passed. The request helper was exercised against a temporary local server with a quoted header argument. Mutating, long-running, browser, and container-control recipes were dry-run only; the container build had already passed during the pnpm migration.

## 2026-07-14: QA cleanup

- [x] Run `just qa`.
- [x] Replace deprecated top-level `disableRequestLogging` configuration with Fastify's `LogController` API.
- [x] Resolve the Biome optional-chain warning in trace-context parsing.
- [x] Rerun `just qa` and coverage without warnings.

Validation: the focused logging suite passed 22 tests; `just qa` passed 354 tests with 7 skipped; `just cov` reported 100% statements, 98.87% branches, 100% functions, and 100% lines. No Biome or Fastify deprecation warnings remained.

## 2026-07-14: Full codebase modernization

### Baseline and research

- [x] Confirm all declared dependencies are current with `pnpm outdated`.
- [x] Confirm TypeScript 7.0.2, Biome 2.5.3, Fastify 5.10.0, Node.js 24, and pnpm 11.13.0.
- [x] Pin the latest Node.js 24 patch, v24.18.0, in `.node-version` and verify it with Homebrew-installed `fnm`.
- [x] Review TypeScript 7 migration defaults and removed/deprecated TypeScript 6 behavior.
- [x] Review Biome project, test, and type-aware domains and the deprecated `rules.recommended` setting.
- [x] Audit the effective compiler configuration, source tree, tests, coverage policy, scripts, and documentation.

### Compiler, tooling, and dependency hardening

- [x] Verify `fastify-tsconfig` 3.0.0 source, ownership, release history, maintenance status, and TypeScript 7 compatibility.
- [x] Retain the Fastify-maintained preset for its NodeNext, strict, isolated-module, and library-boundary defaults; layer project-specific TypeScript 7 checks on top.
- [x] Add exact optional properties, unchecked indexed access, erasable syntax, explicit module detection, and stricter control-flow checks.
- [x] Typecheck production and test code.
- [x] Adopt Biome's `preset` configuration and enable project, test, and type-aware domains.
- [x] Promote correctness, security, complexity, and promise-safety rules to errors.
- [x] Remove unused `@fastify/autoload` and `fastify-cli` dependencies.
- [x] Run coverage across the full suite, include `app.ts`, and raise global thresholds to 90%.
- [x] Resolve all new TypeScript and Biome findings.
- [x] Modernize source and tests based on exact optional properties, guarded indexing, and erasable syntax.
- [x] Remove unused environment configuration and update the checked-in example.
- [x] Align CI, Docker, README, AGENTS, and local workflows.
- [x] Run final QA, coverage, container build, and runtime smoke.

### Decisions and findings

- `fastify-tsconfig` is a small Fastify-owned preset, not a compiler integration. Version 3.0.0 was released in January 2025, its repository is active and unarchived, and TypeScript 7.0.2 resolves the inherited configuration successfully. Keeping it provides a recognizable Fastify baseline while explicit project overrides target ES2024 and add stricter checks.
- Align `@types/node` with the Node.js 24 runtime instead of following the registry's Node 26 `latest` tag. This removes the `thread-stream` declaration mismatch and allows the project to override the preset with `skipLibCheck: false`, so dependency declarations are checked too.
- Enforce the Node runtime/type-major invariant in `AGENTS.md` and suppress Dependabot major proposals for `@types/node`; Node types may cross major only in the same change as the runtime.
- Do not enable Biome's entropy-based `noSecrets` rule. At error severity it misidentified public URLs, schema IDs, error names, and synthetic fixtures; noisy security checks reduce trust. Credential handling remains documented and should be enforced by repository secret scanning.
- Disable Biome's `useLiteralKeys` rule because it recommends dot access where TypeScript's `noPropertyAccessFromIndexSignature` deliberately requires bracket access. The TypeScript safety rule is authoritative.
- Do not emit source maps or pass Node's `--enable-source-maps` flag. The application has structured server-side error logging and production-safe client errors, while source maps would add runtime artifacts and stack-processing overhead without a demonstrated operational requirement.
- Remove unused `FIREBASE_PROJECT_NUMBER`, `SECRET_MANAGER_ENABLED`, `APP_ENVIRONMENT`, and `APP_URL` settings rather than documenting configuration with no consumer.
- Keep `/health` as dependency-free process liveness by using the supported route-level pressure handler; keep Firestore and shutdown readiness on `/status`. This prevents dependency outages from triggering process restart loops.

### Final validation

- `fnm install 24.18.0 && fnm use`: passed; local checks ran on Node.js v24.18.0 with pnpm 11.13.0.
- `just qa`: passed without Biome warnings; TypeScript source and tests passed; tests passed.
- `just check`: passed; 34 test files passed, 1 skipped; 347 tests passed, 7 skipped.
- Coverage passed the 90% gates: 99.65% statements, 98.57% branches, 100% functions, and 99.82% lines.
- `pnpm build`: passed with full dependency declaration checking.
- `pnpm dedupe --check`: passed after aligning all compatible transitive consumers to Node 24 types.
- `pnpm audit --audit-level high`: passed with no high or critical findings.
- `just container-build fastify-playground:modernize`: passed with frozen development and production installs.
- Distroless non-root runtime smoke passed: `/health` returned 200 without credentials and `/status` returned 503 because Firestore was intentionally unavailable.
- `git diff --check`: passed.

### Remaining risk

- The package audit reports one moderate `uuid` 9.0.1 advisory through the latest `firebase-admin` -> `@google-cloud/storage` dependency graph. The affected API requires caller-supplied buffers for UUID v3/v5/v6; this application does not call `uuid` directly. The current upstream storage packages constrain `gaxios` and `teeny-request` to UUID 9, so a forced transitive major override would be less trustworthy than tracking the upstream fix.

### Human and agent documentation

- [x] Define `README.md` as the human-facing project guide and `AGENTS.md` as the coding-agent execution contract.
- [x] Replace duplicated, stale root and test agent guidance with concise rules tied to the enforced configuration.
- [x] Align the human quick start and development workflow with the root `Justfile`.
- [x] Move the environment template to the repository root, where `just` and container recipes consume `.env`.
- [x] Replace `.github/skills` with portable `.agents/skills` packages modeled on `fastapi-playground`.
- [x] Add Codex UI metadata for Fastify endpoints, Fastify plugins, Firebase testing, TypeBox schemas, Vitest testing, OpenAPI contracts, and README maintenance.
- [x] Validate all seven skills with the skill-creator validator.

## 2026-07-14: CBOR and HTTP content-negotiation hardening

### Research and reference comparison

- [x] Review the recent `fastapi-playground` negotiation work, especially commits `acb1212` (unified JSON and CBOR negotiation) and `fac7683` (negotiate before oversized-body handling).
- [x] Verify RFC 9110 `Accept` quality grammar, specificity precedence, exact `q=0` exclusions, and 406 behavior.
- [x] Verify RFC 8949 registers `application/cbor` for a single CBOR data item.
- [x] Verify RFC 9457 defines `application/problem+json` and permits it as an error fallback even when it is not listed in `Accept`.
- [x] Verify RFC 9290 registers `application/concise-problem-details+cbor` with a different compact CoAP-oriented data model.
- [x] Verify the IANA media-type registry does not contain `application/problem+cbor`.

Primary references: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.1), [RFC 8949](https://www.rfc-editor.org/rfc/rfc8949.html#section-9.3), [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html#section-3), [RFC 9290](https://www.rfc-editor.org/rfc/rfc9290.html#section-6.3), and the [IANA media-type registry](https://www.iana.org/assignments/media-types/media-types.xhtml).

### Findings

- The previous `@fastify/accepts-serializer` setup treated JSON as an unconditional fallback, preferred CBOR on equal unweighted lists, and could not enforce 406 before request parsing or handler execution.
- The previous substring helper ignored q-values, specificity, invalid quality syntax, media parameters, and exact exclusions.
- `application/problem+cbor` was advertised and emitted even though it is not registered. RFC 9290 concise problems cannot replace it without implementing a different data model.
- The request parser claimed every `application/*+cbor` type, including vendor formats the application does not own.
- `$schema` was injected into ordinary response instances even though it is a JSON Schema dialect keyword. RFC 8288 `Link` discovery is sufficient and representation-neutral.

### Implementation

- [x] Replace `@fastify/accepts-serializer` with a local, tested RFC 9110 negotiation utility and Fastify plugin; remove the dependency and lockfile entries.
- [x] Make route `schema.produces` and `schema.consumes` the shared runtime and OpenAPI source of truth.
- [x] Negotiate modeled success representations in `onRequest`, before body parsing, validation, dependencies, or handlers.
- [x] Default to JSON, keep JSON on wildcards and ties, require explicit positive-quality CBOR, honor the most specific range, and reject unsupported success preferences with 406.
- [x] Bypass representation negotiation for 204 and 205 responses.
- [x] Encode CBOR after Fastify's response schema serializer so undeclared response fields remain filtered.
- [x] Restrict request parsing to exact `application/cbor` with optional media-type parameters; reject unowned `+cbor` types with 415.
- [x] Emit RFC 9457 errors as `application/problem+json` by default or generic registered `application/cbor` when explicitly preferred; retain JSON as a best-effort fallback.
- [x] Remove `$schema` from payload schemas and runtime bodies; retain relative RFC 8288 `Link` discovery headers.
- [x] Make schema discovery documents standalone by declaring Draft 2020-12 and rewriting OpenAPI component references into local `$defs`.
- [x] Move request ID, logging, and `Vary` hooks before negotiation so early 406 responses remain correlated, logged, and cache-correct.
- [x] Generate OpenAPI success, request-body, error media types and common response headers from the implemented contract.
- [x] Update README, AGENTS, and portable skills with the hardened rules.

### Validation

- Focused negotiation, CBOR parser, error handler, schema discovery, schema registry, Swagger, and composed-app tests passed.
- `just qa` passed on Node.js 24.18.0 and pnpm 11.13.0: Biome applied no changes, source and tests passed TypeScript 7 strict checking, and 350 tests passed with 7 opt-in integration tests skipped.
- `just check` passed all non-mutating gates.
- Coverage passed the 90% gates: 97.63% statements, 93.36% branches, 100% functions, and 99.54% lines.
- `pnpm --dir app build`, `pnpm --dir app dedupe --check`, and `git diff --check` passed.
- The distroless non-root container rebuilt with frozen development and production pnpm installs.
- Production-image smoke passed with no Firestore credentials: `/health` returned 200 JSON, `/v1/hello` returned the expected readiness 503 as CBOR when explicitly requested, unsupported success `Accept` returned 406 Problem JSON before readiness handling, and `/status` returned 503 JSON.

## 2026-07-15: Adversarial testing skill

- [x] Copy the complete `.agents/skills/adversarial-testing` package from `fastify-observability`, including Codex UI metadata.
- [x] Preserve the generic, repository-independent testing workflow verbatim.
- [x] Validate the copied package with the skill-creator validator and confirm it matches the source.

## 2026-07-15: fastify-observability consumer migration

### Research and contract

- [x] Verify npm registry state: `fastify-observability` 0.2.0 is current and supports Node.js 24 with Fastify `^5.10.0`.
- [x] Review the package README, public exports, source, lifecycle tests, and its explicit `fastify-playground` migration investigation.
- [x] Treat migration as a full replacement rather than a compatibility wrapper.

### Implementation

- [x] Add `fastify-observability` and remove `@fastify/request-context`.
- [x] Delete the local request-ID and logging plugins and their obsolete tests.
- [x] Configure the package-created GCP Pino logger, validated request-ID generator, canonical `request_id` label, and disabled Fastify request logging in the Fastify constructor.
- [x] Register observability first at the root, before every application hook and route.
- [x] Remove duplicate generic error-handler logs and response request-ID ownership; retain safe domain diagnostics only where they add distinct context.
- [x] Remove the legacy project-qualified trace fields and trace-only `GOOGLE_CLOUD_PROJECT` configuration.
- [x] Fix lifecycle hooks to remove process listeners when their Fastify instance closes.
- [x] Keep Vitest output quiet with the supported `silent` threshold while explicitly enabling logs in observability contract tests.
- [x] Update README, AGENTS, test guidance, and portable skills to describe and enforce the package contract.

### Validation

- [x] Focused composed-app and lifecycle suites passed: 17 tests.
- [x] TypeScript 7 source and test type-checking passed.
- [x] `just qa` passed: Biome emitted no diagnostics, TypeScript passed, and 322 tests passed with 7 opt-in tests skipped.
- [x] `just check` passed, including coverage at 97.65% statements, 93.26% branches, 100% functions, and 99.52% lines.
- [x] `pnpm --dir app build` and `pnpm --dir app dedupe --check` passed.
- [x] `pnpm --dir app audit --audit-level high` passed with no high or critical findings; the previously documented optional transitive UUID 9 advisory remains moderate through `firebase-admin`.
- [x] The frozen-install distroless non-root container rebuilt successfully with `fastify-observability` 0.2.0 in both build and production dependency stages.
- [x] Production-image smoke passed without Firebase credentials: `/health` returned 200 with caller request-ID and bare W3C trace correlation, `/status` degraded to 503, each request emitted exactly one terminal record, and neither the query canary nor a fabricated GCP span field appeared.
- [x] `git diff --check` passed and no legacy local observability imports or trace-only environment settings remain.

## 2026-07-15: Adversarial whole-codebase pass

### Failure model and audit

The largest risk in a public example is a broad green suite that verifies framework plumbing while missing application-owned boundary behavior. The audit therefore prioritizes observable contracts, malformed input, security defaults, dependency failures, privacy, and lifecycle cleanup over test count.

- [x] Inventory every source and test file and classify tests by the behavior they can detect.
- [x] Compare pagination and CBOR behavior with the hardened FastAPI reference implementation.
- [x] Review current Fastify, Node.js, Firebase Admin, and `@fastify/cors` guidance for lifecycle, credentials, and origin validation.
- [x] Identify production defects that existing tests did not catch: backward pagination repeats the current page; encoded empty cursors are accepted; authorization parsing accepts extra fields; production CORS trusts localhost implicitly; upstream GitHub details can escape through 5xx responses.
- [x] Identify architecture and contract gaps: process-global lifecycle ownership inside a plugin, service-account files loaded by application code instead of ADC, missing OpenAPI operation IDs, a deployment-specific OpenAPI server URL, and HSTS disabled in every environment.

### Implementation and test hardening

- [x] Correct cursor validation and backward pagination semantics; add mutation-resistant pagination tests.
- [x] Make authorization, CORS, environment, and Firebase credential boundaries explicit and secure by default.
- [x] Separate application construction from process startup and make shutdown behavior deterministic and testable.
- [x] Prevent raw upstream failure details from reaching public 5xx responses.
- [x] Complete and verify the OpenAPI operation contract and production security headers.
- [x] Review every test file using the adversarial-testing skill; remove third-party implementation tests, use behavioral names, replace weak existence assertions, and add missing failure-path coverage.
- [x] Update human documentation, agent guidance, portable skills, and this log to match the final behavior.
- [x] Run focused regression tests, full QA, coverage, build, dependency, container, and runtime validation.

### Implementation decisions

- Decode cursors only when they use the canonical unpadded Base64URL alphabet, fit within 2,048 characters, decode as strict UTF-8, and contain non-empty type and value components. The absent query parameter remains the sole first-page sentinel.
- Represent a previous link to the first page as `null` internally so link generation can distinguish it from no previous page and omit the `cursor` query parameter.
- Parse and normalize `CORS_ORIGINS` once at startup. The empty default authorizes no browser origins, exact string matching avoids per-request regular expressions, and a denied origin omits CORS authorization instead of producing a false 5xx.
- Let Firebase Admin load `GOOGLE_APPLICATION_CREDENTIALS` through Application Default Credentials. Application code no longer imports or parses service-account JSON.
- Keep `app.ts` as the pure composition root and use `server.ts` for listening and SIGINT/SIGTERM ownership. Do not install `uncaughtException` or `unhandledRejection` handlers or call `process.exit()` during asynchronous cleanup.
- Enable HSTS only in the production composition so local HTTP remains usable.
- Map GitHub transport failures and malformed error bodies to a stable upstream error. Preserve the original cause internally and expose controlled public detail for all GitHub errors.
- Register Swagger before the readiness plugin so `/status` appears in OpenAPI. Every public operation now has a stable unique `operationId`, and the document uses the deployment-neutral `/` server.
- Remove unused `FIREBASE_PROJECT_ID` configuration and stale Firebase emulator/deployment scripts that had no checked-in Firebase configuration.
- Treat reduced test count as an improvement when it removes tests of third-party APIs. The suite now favors exact contracts, negative assertions, credible dependency failures, and off-by-one boundaries.

### Adversarial test outcomes

- Backward pagination now proves page three returns exactly to page two and that page two links to page one without repeating records.
- Cursor matrices cover empty, malformed, noncanonical, invalid UTF-8, empty-field, oversized, wrong-resource, and stale inputs.
- Authentication rejects extra segments, repeated spaces, tabs, leading whitespace, missing tokens, revoked tokens, and verification failure without invoking Firebase for syntax failures.
- CORS covers exact allow, lookalike domains, different ports, localhost without configuration, malformed origins, credential headers, and requests without `Origin`.
- Server tests cover state transition before close, concurrent signal coalescing, cleanup failure exit status, signal listener removal, and absence of fatal process handlers.
- GitHub tests cover transport rejection, non-JSON upstream errors, retry metadata, and response-detail canaries that must not escape.
- The composed OpenAPI test requires all 11 public operations to have unique identifiers, which exposed and fixed the previous `/status` registration-order omission.
- Removed most of the `@fastify/sensible` API suite, registration-only tests, repetitive per-method `Vary` cases, weak `toBeDefined()` assertions, and a contrived string-throw route case.

### Validation

- Focused pagination, security-boundary, lifecycle, GitHub, error-handler, and composed-app tests passed during implementation.
- `just qa` passed after Biome's strict complexity rule prompted a smaller CORS parser design: 32 test files passed, one opt-in file skipped; 303 tests passed and 7 live GitHub tests skipped.
- `just check` passed all non-mutating gates. Coverage remained well above policy after removing low-signal tests: 97.26% statements, 92.97% branches, 98.55% functions, and 99.25% lines.
- `pnpm --dir app build` and `pnpm --dir app dedupe --check` passed on Node.js 24.18.0.
- `pnpm --dir app audit --audit-level high` passed with no high or critical findings; the known optional transitive UUID 9 issue remains moderate through `firebase-admin`.
- All eight `.agents/skills` packages passed the skill-creator structural validator after their contracts were aligned with the final architecture and adversarial test policy.
- The distroless non-root image rebuilt with frozen development and production pnpm installs and now starts `dist/server.js`.
- Production-image smoke passed: `/health` returned 200 with HSTS and no authorization for an unconfigured localhost origin; `/status` returned the expected 503 without credentials; SIGTERM logged the request and completed graceful shutdown successfully.

### Remaining external validation

- The seven real GitHub contract tests require `GITHUB_TOKEN` and were intentionally skipped in the default gate.
- Firestore readiness success and Firebase Authentication against emulators were not exercised because this repository does not include an emulator project configuration. Deterministic unit tests cover successful, failed, timed-out, and shutdown readiness behavior.

## 2026-07-15: Post-modernization review remediation

### Investigation

- [x] Reproduce the Firestore readiness timeout and shutdown race against failed and blackholed emulator addresses.
- [x] Trace `GITHUB_TOKEN` from environment decoding through the public, caller-selected GitHub proxy routes.
- [x] Compare GitHub repository permissions, primary and secondary rate-limit behavior, the 2026-03-10 REST API contract, and live activity payloads with the client implementation.
- [x] Verify Fastify 5 handler deadlines and cooperative `request.signal` cancellation against the installed and current upstream documentation.
- [x] Verify Firebase Admin app ownership and `deleteApp()` lifecycle requirements.
- [x] Compare the generated `/status` contract with its runtime media types, headers, and error envelope.
- [x] Verify Cloud Run automatic base-image updates require a scratch application image and are incompatible with this repository's complete distroless runtime image.
- [x] Audit item error classification, shutdown coalescing, CI runtime pinning, container coverage, and unused dependencies.

### Decisions

- Keep `GITHUB_TOKEN` only for opt-in, direct GitHub client integration tests. The running public API must never read or forward a server credential because GitHub's repository endpoints can return private resources when a token has access.
- Accept GitHub's lower unauthenticated quota for the public example instead of creating a credential-confused deputy. Document the quota honestly; production deployments that need more capacity require a different authenticated product boundary, caching, and distributed abuse controls.
- Remove Firestore integration. It has no business consumer, its non-cancellable probe globally gates unrelated routes, and `terminate()` can hang shutdown after a timed-out query. Retain Firebase Admin only for an implemented protected identity endpoint.
- Own `/status` in application code so runtime negotiation, RFC 9457 errors, schema discovery, and OpenAPI describe the same behavior. Readiness covers shutdown state and configured process-pressure thresholds, not optional external services.
- Bound GitHub requests below the application handler deadline, propagate Fastify cancellation, validate every successful upstream payload, and upgrade the explicit GitHub REST API version to 2026-03-10 after confirming its breaking changes do not affect the used endpoints.
- Deploy the checked-in complete distroless image to Cloud Run without automatic base-image flags. Applying those flags requires a separate scratch-image or buildpacks flow; the documented image must be rebuilt and redeployed for runtime patches.

### Implementation progress

- [x] Remove runtime GitHub credential forwarding and document the test-only environment variable.
- [x] Replace unused Firestore readiness with process readiness and add a real Firebase-protected endpoint.
- [x] Add GitHub cancellation, deadlines, response validation, nullability fixes, and rate-limit classification.
- [x] Narrow item cursor error handling and make concurrent shutdown callers await the same cleanup.
- [x] Align OpenAPI, README, AGENTS, `.env.example`, Docker, CI, and dependencies.
- [x] Add adversarial regressions for privacy, malformed upstream data, timeouts, cleanup ownership, readiness, and unexpected failures.
- [x] Isolate composed-app tests from developer `.env` files by pinning every decoded application variable in the fixture.
- [x] Run focused tests, full non-mutating gates, coverage, build, dependency audit, and container lifecycle smoke.

### Validation

- `just qa` passed on Node.js 24.18.0 and pnpm 11.13.0. Biome made no changes, TypeScript 7 accepted source and tests, and 321 tests passed; the seven credential-gated direct GitHub client tests were skipped.
- `just check` passed every non-mutating gate. Coverage remained above policy at 96.94% statements, 92.22% branches, 97.94% functions, and 98.76% lines.
- `pnpm --dir app build`, `pnpm --dir app dedupe --check`, `just install`, and `git diff --check` passed.
- A focused composed-app run passed with deliberately invalid ambient application variables, proving its explicit fixture is isolated from developer `.env` files.
- `pnpm --dir app outdated --long` reported only `@types/node` 26. It remains intentionally on `^24.13.3` because types must match the pinned Node.js 24 runtime.
- The production-only dependency audit found no high or critical vulnerabilities. One known moderate `uuid@9.0.1` advisory remains in Firebase Admin's optional Google Cloud Storage dependency tree; application code does not use that package's affected buffer-writing API.
- The distroless non-root image rebuilt from frozen development and production installs. Image metadata confirmed UID/GID `65532:65532`, the distroless Node entrypoint, and no source-map runtime flag.
- Production-image smoke passed without credentials: `/health` returned 200, application-owned `/status` returned 200, `/v1/auth/me` returned the expected 401, and a live unauthenticated `/v1/github/owners/octocat` request returned the public account. SIGTERM cleanup completed with exit code 0.
- Historical Firestore validation entries above are retained as the chronological modernization record. This remediation supersedes them: Firestore is no longer a runtime dependency or readiness condition.

### Remaining external validation

- Firebase Authentication was not exercised against a real project or emulator because no credentialed/emulator environment is part of the repository. Deterministic tests cover token success, invalid and revoked identity failures, provider/configuration failures, minimal claim projection, and owned-versus-borrowed Firebase app cleanup.
- The seven token-gated direct GitHub client contract tests remain opt-in. The production smoke separately verified the deployed unauthenticated public-proxy path against GitHub.
