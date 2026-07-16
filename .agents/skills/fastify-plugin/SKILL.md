---
name: fastify-plugin
description: Create or change fastify-playground Fastify plugins, including decorators, encapsulation, plugin dependencies, lifecycle hooks, logging, content negotiation, Firebase infrastructure, registration order, and unit tests.
---

# Fastify plugins

Read `AGENTS.md`, `app/src/app.ts`, the neighboring plugins, and their tests before changing plugin behavior. Read `app/src/server.ts` only for process lifecycle work.

## Workflow

1. Decide whether the behavior is cross-cutting infrastructure or feature behavior. Put only the former in `app/src/plugins/`.
2. Identify the encapsulation boundary, exposed decorators, registration dependencies, owned resources, and hook order before editing.
3. Reuse an existing plugin or utility when it already owns the concern.
4. Wrap with `fastify-plugin` only when decorators or hooks must escape encapsulation. Declare a stable name, Fastify range, and real plugin dependencies.
5. Extend Fastify types beside each decorator and initialize shared clients once at registration.
6. Register the plugin in the correct `app/src/app.ts` layer and update the layer description if the dependency graph changes.
7. Apply `$adversarial-testing`, then test application-owned behavior, forbidden side effects, failure paths, and cleanup.

## Safety checks

- Clean up only resources initialized by this process, and propagate meaningful cleanup failures.
- Keep process signals in `app/src/server.ts`; plugins must not install process-global handlers.
- Preserve the single root `fastify-observability` registration and its canonical logger, request-ID, trace-context, and terminal-record wiring.
- Do not add parallel access logging, request context, trace parsing, or request-ID generation.
- Keep hooks bounded and never log credentials, authorization data, cookies, bodies, or PII.
- Validate startup configuration once where possible; request hooks should enforce already-decoded policy.
- Register Swagger before plugins that create documented routes.

## Verification

Run the focused plugin test first, then:

```bash
just check
pnpm --dir app build
```

Run `just container-build` when dependencies, build output, startup, shutdown, or runtime composition change.
