---
name: readme-review
description: Evidence-based README.md audit for this Fastify project. Use when human-facing setup, capabilities, routes, configuration, operations, or contribution guidance needs verification.
---

# README review

Keep `README.md` for human users and contributors. Keep coding-agent execution rules in `AGENTS.md` and reusable workflows in `.agents/skills/`.

Read `AGENTS.md` and `.agents/skills/readme-maintenance/SKILL.md`, then verify every affected claim against its source of truth:

- commands: `Justfile` and `app/package.json`;
- versions and dependencies: `app/package.json`, `app/pnpm-lock.yaml`, and `app/tsconfig.json`;
- configuration: `.env.example` and `app/src/env.ts`;
- routes and behavior: `app/src/app.ts`, `app/src/routes/`, `app/src/modules/`, and tests;
- API contracts: TypeBox schemas, OpenAPI and schema-discovery plugins, and contract tests;
- containers and deployment: `app/Dockerfile` and the documented Cloud Run commands;
- CI: `.github/workflows/` and `.github/dependabot.yml`.

Require every named command, path, route, default, environment variable, and version to exist. Describe implemented behavior without claiming unverified production readiness, security properties, deployment state, or CI coverage. Remove stale content instead of preserving an obsolete structure.

Keep setup, features, architecture, API use, configuration, development, containers, deployment, and contribution entry points concise. Do not copy detailed coding conventions, test patterns, or skill instructions into the README.

Validate relevant recipes, run `git diff --check`, and reread the complete README for contradictions before finishing.
