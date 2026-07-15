---
name: fastify-plugin
description: Create or change fastify-playground Fastify plugins, including decorators, encapsulation, plugin dependencies, lifecycle hooks, logging, content negotiation, Firebase infrastructure, registration order, and unit tests.
---

# Fastify plugins

Read `AGENTS.md`, `app/src/app.ts`, `app/src/server.ts` when lifecycle is involved, the neighboring plugins, and their unit tests before changing a plugin.

## Design

- Put cross-cutting or infrastructure behavior in `app/src/plugins/`; keep feature behavior in modules.
- Wrap a plugin with `fastify-plugin` only when its decorators or hooks must escape Fastify encapsulation.
- Give wrapped plugins a stable name, Fastify compatibility range, and accurate `dependencies` list.
- Extend Fastify module types next to each decorator. Decorate instance or request state before assigning values.
- Initialize clients and services once at registration. Clean up only resources owned by the plugin in `onClose`.
- Keep plugin registration order explicit in `app/src/app.ts` and update its layer description when the dependency graph changes.
- Register Swagger before any plugin that creates a documented route. Keep process signals in `app/src/server.ts`; application plugins do not own process-global handlers.

Use `node:` imports, `.js` relative extensions, explicit type imports, and TypeScript 7 erasable syntax. Omit absent optional properties rather than assigning `undefined`.

## Safety

Keep request hooks bounded and deterministic. Do not log authorization headers, tokens, bodies, credentials, or PII. Preserve the `fastify-observability` contract: one correlated terminal access record per request and no parallel request-ID, trace, request-context, or access-log plugin. Keep production 5xx details generic.

Validate CORS origins once at startup and compare exact strings per request. Never implicitly trust localhost, combine credentialed CORS with a wildcard, or throw a server error merely because a browser origin is denied.

Register `fastify-observability` once at the root before application hooks and routes. Keep its canonical logger, request-ID generator, disabled Fastify request logging, and `request_id` label wiring together. Domain logs may add distinct context but must not repeat bound correlation fields or duplicate the generic terminal error record.

Do not duplicate an existing Fastify or local plugin. Add a dependency only when it replaces more code or risk than it introduces.

## Verification

Apply the adversarial-testing skill, then add or update `app/tests/unit/plugins/<name>.test.ts`. Cover application-owned decorators, hook behavior, dependency failures, cleanup, and error paths. Do not test registration success or a dependency's documented API. Use `fastify.inject()` and shared Firebase mocks; do not bind a port or contact real services.

Run the focused plugin test, then `just lint`, `just typing`, and `just test`. Run `just container-build` when startup, shutdown, dependencies, or runtime composition changes.
