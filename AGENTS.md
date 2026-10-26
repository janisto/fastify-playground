# AGENTS.md

Instructions for coding agents. Keep execution rules here; `README.md` serves
human users and contributors. Do not duplicate agent instructions into it.

## Engineering priorities

- Prioritize correctness, readability, maintainability, then performance.
- Inspect the implementation, callers, and tests before changing behavior.
- Prefer the smallest safe change; reuse or refactor local patterns and utilities
  before adding abstractions or dependencies.
- Validate review findings against requirements and reproducible behavior.
  Simplify unnecessary behavior instead of adding machinery to defend it.
- State the failure mode before architectural, security, persistence, or
  production-impacting changes.
- Report implementation, validation, and remaining risks before completion.
- Keep instructions, comments, and documentation concise. Explain and obtain
  explicit approval before removing, merging, or relocating guidance, including
  obsolete rules, completed-task narration, and duplicates.
- Keep public code, instructions, comments, documentation, commits, and PR text
  self-contained. Do not disclose private coordination repositories, paths,
  revisions, or discussions.

## Epistemic honesty and scope discipline

- Report defects, corrupted data, unmet requirements, and unfinished work plainly.
  Never conceal them in justifications or relabel them as simplifications,
  provisional scope, or expected limitations. If a problem is deeper than
  expected, stop at a safe boundary and report the exact failure, affected
  behavior or records, and remaining work.
- Counts, checksums, and passing tests show consistency, not semantic correctness.
  Before claiming body parsing, TypeBox decoding, or Firestore transformations work,
  inspect accepted inputs, decoded values, and resulting profiles using synthetic
  fixtures or
  authorized data. Hunt for false positives; report the worst counterexamples,
  or describe the sample when none were found.
- Fix the bug class behind cited failures: correct the grammar, validation, query,
  or logic and audit all affected paths or records within the authorized scope.
  Do not hardcode cited values into exceptions or blocklists, or patch only named
  IDs.
- Do not weaken specifications, `AGENTS.md`, or active plans to excuse defects or
  shortcuts. Follow current task scope and stop gates. For review-only or
  report-only work, edit only an explicitly requested report.
- After the final code, schema, or generator change, regenerate affected OpenAPI,
  schema, and fixture artifacts, rebuild affected test data, and rerun relevant
  checks. Earlier passing results do not validate later edits.

## Commits and pull requests

- Use [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):
  `type: imperative description`. Add a scope only when it materially improves
  clarity. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`,
  `ci`, `chore`, and `revert`.
- Use the same format for PR titles, suitable for the final merge commit. Keep PRs
  focused; describe the problem, resulting behavior, validation, and remaining
  risks.
- Mark breaking changes with `!` and a `BREAKING CHANGE:` footer explaining the
  impact.
- Work on task branches; never commit directly to the default branch.
- Before committing, always run `just qa` and `git diff --check`.
- Use one atomic PR when layers would require manual settings changes between
  merges. A stack must be mergeable as a whole.
- This repository has no `CHANGELOG.md`; do not create one or require entries.

## Skills and validation

### Required guidance

- Use `.agents/skills/edit-agent-instructions/SKILL.md` when reviewing or editing
  root or nested agent instructions.
- Use `.agents/skills/adversarial-testing/SKILL.md` whenever planning, creating,
  modifying, reviewing, debugging, or evaluating tests. Apply relevant language,
  framework, and infrastructure testing guidance alongside it.
- Use `.agents/skills/readme-maintenance/SKILL.md` for README audits and edits.
  Assess README impact when API behavior/contracts, persistence, configuration,
  setup, commands, architecture, tooling, deployment, CI, or supported versions
  change. Edit the README only for stale or missing reader-facing claims.

### Validation

Before changing tests or application behavior requiring tests, read
[app/tests/AGENTS.md](app/tests/AGENTS.md). Apply `adversarial-testing` alongside
framework-specific guidance; test observable behavior and forbidden side effects.

For changes affecting the application, run the narrowest relevant test first, then:

```bash
just check
(cd app && corepack pnpm build)
```

Run `just container-build` when package installation, build output, runtime startup, or Docker configuration changes. Update `README.md`, this file, test guidance, and the relevant plan log when commands or contracts change.

## GitHub automation

This example is not deployed; GCP is a possible future target. Keep deployment
manual and project-agnostic. Pushes, PRs, and merges must not deploy it.

- Keep Dependabot security alerts and automated security updates disabled.
  Preserve scheduled version updates and native audits; do not add replacement
  alert bots or repeatedly triage unchanged upstream constraints.
- Keep auto-merge limited to verified Dependabot minor/patch updates behind required checks. Handle old excluded-tool
  PRs once; do not duplicate Dependabot ignore rules with package filters, enablement triggers, state queries, or
  revocation steps.
- Keep required `lint` and `ci` checks. Pure lint runs independently with minimal setup; `ci` fails unless quality, tests, container validation, actionlint, and zizmor all succeed. Workflow scanners run independently of language quality.
- Before workflow changes, inspect required checks in GitHub Settings > Rules > Rulesets using Chrome. Verify both check names and GitHub App sources. The required `ci` and `lint` checks are bound to GitHub Actions; a same-named result from another app does not satisfy that binding. An `any source` rule has no app restriction. Preserve required contexts and sources until replacement enforcement reaches the protected trunk. Update equivalent mappings in Chrome when needed, and verify the final ruleset against actual PR checks before completion.
- Local workflow checks use actionlint 1.7.12 and zizmor 1.31.1 offline with the pedantic persona, matching CI. Run one enforcing plain-mode zizmor CI scan with read-only permissions; do not add duplicate SARIF uploads or security-event write permissions.
- Reference GitHub Actions by explicit full release tags such as
  `owner/action@v1.2.3`, not full commit SHAs or floating major-version tags.
  Dependabot updates those release tags.

## Repository layout

- `app/`: the active Fastify application.
- `app/src/modules/<name>/`: feature schemas, routes, services, and repositories or external clients.
- `app/src/plugins/`: infrastructure and cross-cutting Fastify plugins.
- `app/tests/`: unit and integration tests. Additional rules are in `app/tests/AGENTS.md`.
- `functions/`: placeholder only; it is not currently a Node.js package.
- `plans/`: durable implementation and migration logs.

Support only the latest Node.js LTS line and latest stable TypeScript. The current
baseline is Node.js 24; `.node-version` and `app/package.json` own exact runtime
and package-manager pins. Use Corepack pnpm; do not use npm, Yarn, or another
lockfile. Keep `@types/node` on the runtime major and update both together.
Automatic peer installation is disabled: declare every used peer dependency.
Preserve exact runtime compatibility, strict peers, the one-day quarantine, no
trust downgrades, dependency build review, and no exotic subdependencies. Keep
exceptions narrow and justified.

Run package scripts from `app/`, or use the root `Justfile`:

```bash
just install
just qa
just check
just cov
just fuzz
just workflow-check
just container-build
```

`just qa` applies safe Biome fixes, then runs the complete `just check` gate, including workflow scanners, lint, types, coverage, and the production audit. Use `just check` when a non-mutating validation run is required.

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
- Request bodies accept only the media types the route owns. Plain JSON accepts only an optional `charset=utf-8` parameter; CBOR accepts no parameters. Do not claim arbitrary `+cbor` suffixes.
- Portable body parsing is strict: reject invalid UTF-8 JSON, duplicate object or map keys, trailing data, transparent decompression, unknown top-level application members, and bodies above 1,000,000 octets.
- Errors use RFC 9457 `application/problem+json` by default or the same fields encoded as `application/cbor` when explicitly preferred. Do not use the unregistered `application/problem+cbor`; RFC 9290 concise CBOR problems are a different model and are not implemented.
- Negotiated responses include `Vary: Accept, Origin`.
- Pagination uses canonical unpadded Base64URL cursors, a 2,048-character maximum, and RFC 8288 `Link` headers. Previous links must return the preceding page without repeating the current page; link to the first page by omitting `cursor`.
- Shared response schemas have `$id` values. Response instances receive an RFC 8288 `Link` with `rel="describedby"`; do not inject the JSON Schema `$schema` keyword into API data. Standalone `/schemas/*.json` documents declare Draft 2020-12 and rewrite component references into local `$defs`.

## Authentication, security, and logging

- Verify Firebase ID tokens with Firebase Admin SDK. Do not add application-managed JWT verification.
- The Firebase plugin owns the Admin app and exposes Authentication. Reuse an existing default Firebase app; otherwise initialize a uniquely named app per Fastify instance. Delete only the named app owned by that instance. The profile module obtains Firestore lazily from that app and keeps profile writes transactional and cancellation-aware.
- Never commit, log, or include credentials, tokens, authorization headers, cookies, or PII in fixtures.
- Use Application Default Credentials in production and emulators or `GOOGLE_APPLICATION_CREDENTIALS` locally.
- Validate `CORS_ORIGINS` at startup as exact HTTP(S) origins. The secure default is empty; never trust localhost implicitly, use wildcard origins with credentials, or turn a denied origin into a 5xx response.
- Parse bearer authorization as case-insensitive `Bearer`, one or more ASCII spaces, and exactly one token68 credential. Reject repeated fields, extra fields, tabs, or other whitespace before calling Firebase, and always verify revocation.
- `fastify-observability` owns the Pino instance, validated request IDs, W3C trace context, request correlation, response request-ID header, and the single terminal access record. Do not add parallel request-ID, request-context, trace-parsing, or access-log plugins.
- Keep the canonical Fastify constructor wiring: package-created `loggerInstance`, `requestIdHeader: false`, package `genReqId`, disabled Fastify request logging, and `requestIdLogLabel: "request_id"`. Register the package once at the root before other hooks and routes with Trace Context Level 1 and native error, concrete path, peer IP, and User-Agent capture disabled.
- Log through `fastify.log`, `request.log`, or `reply.log`, not `console`. Do not emit a second generic raw-error record from the error handler; the terminal record already captures final status and abnormal outcome. Domain diagnostics must use controlled fields and must not serialize arbitrary error causes.
- Do not repeat bound correlation names in per-call log objects. Application fields use snake_case, and domain diagnostics must add information beyond the terminal record.
- The GCP preset uses the validated bare W3C trace ID and Trace Context Level 1 semantics. Do not restore project-qualified trace resources, expose the incoming parent as a current span, claim span creation, opt into draft Level 2 behavior without an explicit contract change, or require a Google Cloud project ID for correlation.
- Keep production 5xx response details generic while retaining structured server-side terminal failure metadata.
- Treat upstream response bodies and transport errors as untrusted. Preserve internal error chaining without serializing it into terminal logs, and expose controlled public details for upstream failures.
- Use **API `GITHUB_TOKEN`** for the optional application/test environment variable. Public GitHub proxy routes are deliberately unauthenticated upstream; the API `GITHUB_TOKEN` is only for opt-in tests that instantiate `GitHubClient` directly, and the running application must never read or attach it to caller-selected owner or repository paths.
- Keep the application handler deadline at 15 seconds and GitHub's overall request deadline below it. Pass `request.signal` through routes and services, and validate every successful upstream payload before mapping it to the public schema.
- `/health` is a pressure-bypassed process liveness probe. `/status` is application-owned JSON readiness for shutdown and process pressure; do not globally gate it or unrelated routes on an optional external dependency.
- Keep the runtime container non-root and minimal. Do not add source maps or development dependencies without an operational need.

## Dependency modernization

Update implementations, tests, and documentation with dependency upgrades; retain a below-latest version only for a verified compatibility or tooling constraint. Keep the one-day release quarantine.

Dependabot ignores every `@biomejs/biome` version. Agents upgrade Biome separately because even patch releases can
change diagnostics, configuration, and fixes. Review official release notes, update the package/lockfile and
standalone CI pin together, run `biome migrate`, review rules and scoped analyzer exceptions, apply safe fixes, and
run `just qa` plus the build. Apply the same review when upgrading Biome during a general modernization.

## Biome

Use the Biome version pinned in `app/package.json` for formatting and linting. The root configuration enables recommended project, test, and type-aware
domains plus strict correctness, security, promise, and import rules. Its overload inference incorrectly reports
Fastify's promise-returning `inject` and `listen` calls as synchronous, and async plugins as void callbacks. Disable
`useAwaitThenable` only in the server entry point and tests, and `noMisusedPromises` only in the two affected auth test
fixtures. Keep these rules enabled elsewhere, retain `noFloatingPromises`, and recheck the scoped exceptions on each
Biome upgrade. Do not remove valid awaits or wrap framework calls merely to appease inference.

- Do not add suppression comments to avoid fixing actionable diagnostics.
- `pnpm check:fix` applies safe fixes only. Review unsafe suggestions individually.
- `correctness.noUndeclaredDependencies` is an error; declare every imported package directly.
- Keep imports organized and all diagnostics at zero.
- The entropy-based `noSecrets` rule is intentionally not enabled because it produced false positives on public identifiers and fixtures; secret prevention remains a contributor and platform scanning responsibility.
