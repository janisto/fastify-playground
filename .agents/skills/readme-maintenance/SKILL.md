---
name: readme-maintenance
description: Audit or update fastify-playground README.md when routes, configuration, setup, development commands, architecture, Firebase, observability, containers, deployment, CI, or supported versions change; keep human documentation separate from agent rules.
---

# README maintenance

Read `AGENTS.md`, then verify every affected `README.md` claim against the current repository. Write `README.md` for human users and contributors. Put agent execution rules, detailed implementation constraints, and reusable workflows in `AGENTS.md` or `.agents/skills/`.

## Sources of truth

- application and routes: `app/src/app.ts`, `app/src/server.ts`, `app/src/routes/`, and `app/src/modules/`;
- schemas and errors: `app/src/schemas/`, `app/src/plugins/error-handler.ts`, and contract tests;
- configuration: `app/src/env.ts` and `.env.example`;
- commands: `Justfile` and `app/package.json`;
- dependencies and versions: `app/package.json`, `app/pnpm-lock.yaml`, and `app/tsconfig.json`;
- containers and deployment: `app/Dockerfile` and the documented Cloud Run commands;
- automation: `.github/workflows/` and `.github/dependabot.yml`.

## Accuracy

- Require every named path, route, command, default, environment variable, and version to exist.
- Describe implemented behavior, not aspirational production readiness.
- Keep the project layout concise and mention `.agents/skills/` as portable agent workflows.
- Keep setup, API usage, architecture, configuration, operations, and contribution entry points in the README.
- Remove coding-agent directives, exhaustive style rules, and duplicated test policy from the README; link to `AGENTS.md` instead.
- Remove stale material instead of preserving an obsolete structure.
- Do not claim deployment, security, rate limiting, tracing creation, or CI checks that are not implemented and verified.

## Verification

Dry-run named recipes where practical, search route registration and settings directly, validate links and paths, and run `git diff --check`. For documentation accompanying behavior changes, run `just lint`, `just typing`, and `just test`. Reread the full README for contradictions and duplicated agent guidance.
