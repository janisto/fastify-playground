---
mode: 'agent'
description: 'Update README.md Documentation for Fastify Playground'
---
# Task: Update README.md Documentation

You are tasked with reviewing and updating the README.md file for this Fastify-based REST API project. This file provides guidance to VS Code Copilot when working with code in this repository.

## Your Mission

Conduct a comprehensive analysis of the entire codebase and update the README.md file to ensure it is 100% accurate, complete, and helpful for future VS Code Copilot interactions.

## Analysis Requirements

### 1. Project Overview Verification
- Verify the project description matches the Fastify REST API implementation
- Check if the stated purpose aligns with actual Fastify plugins and routes
- Identify any missing key features (authentication, logging, error handling, etc.)
- Verify OpenAPI/Swagger documentation endpoints are accurate

### 2. Tech Stack Analysis
- Verify all frameworks and their versions by checking:
  - `app/package.json` for dependencies (Fastify, TypeScript, Vitest, etc.)
  - `app/package-lock.json` for exact versions
  - Configuration files (`biome.json`, `tsconfig.json`, `vitest.config.ts`)
- Check Node.js version in `.nvmrc` and `engines` field
- Verify Fastify plugins (@fastify/cors, @fastify/helmet, @fastify/jwt, @fastify/swagger, etc.)
- Identify any Fastify plugins used but not documented
- Remove any technologies listed but not actually used
- Verify folder structure: `app/`, `functions/` (if used)

### 3. Commands Verification
- Verify all npm scripts in `app/package.json`:
  - `dev` (tsx watch mode)
  - `build`, `build:check`, `build:watch`
  - `test`, `test:watch`, `test:coverage`
  - `check`, `check:fix` (Biome)
  - `lint`, `lint:fix`, `format`, `format:fix`
- Document any Firebase-related commands if applicable
- Ensure command descriptions match actual behavior
- Add any missing commonly-used commands

### 4. Architecture & Directory Structure
- Scan the directory structure in `app/`:
  - `src/app.ts` (entry point with AutoLoad)
  - `src/plugins/` (Fastify plugins)
  - `src/routes/` (route handlers)
  - `tests/unit/`, `tests/integration/` (test structure)
- Verify all documented paths exist
- Check that plugin files match documentation:
  - cors.ts, helmet.ts, jwt.ts, sensible.ts, swagger.ts
  - error-handler.ts, lifecycle.ts, request-logging.ts
- Verify route files: health.ts, root.ts
- Document test file organization (one test file per plugin/route)
- Note @fastify/autoload usage with `forceESM: true`

### 5. Automation
- Check for GitHub Actions workflows in `.github/workflows/`
- Document any CI/CD pipelines
- Verify Firebase deployment scripts if present
- Document any build or deployment automation

### 6. Configuration Files
- Document all configuration files and their purposes:
  - `biome.json` (formatting, linting, import organization)
  - `vitest.config.ts` (test configuration, coverage thresholds)
  - `tsconfig.json` (TypeScript ES2024, NodeNext module resolution)
  - `tests/tsconfig.json` (test-specific TypeScript config)
  - `.editorconfig` (editor settings)
  - `.nvmrc` (Node.js version)
  - Environment variables (JWT_SECRET, NODE_ENV, PORT)
  - `.env.local` pattern (gitignored)

### 7. Development Guidelines
- Extract coding conventions from:
  - `.github/copilot-instructions.md` if present
  - Biome rules (double quotes, semicolons, import extensions)
  - TypeScript strict mode settings
  - ESM module system (`"type": "module"`)
  - Import extension requirements (`.js` for relative imports)
  - Node.js protocol prefix enforcement (`node:`)
  - Type-only import enforcement (`import type`)
- Document JSDoc patterns used in plugins
- Identify test patterns (Vitest globals, structure)
- Note V8 coverage ignore comments (`/* v8 ignore next -- @preserve */`)

### 8. Integration Points
- Document Fastify plugin integrations:
  - JWT authentication flow
  - CORS origin validation
  - Helmet security headers
  - OpenAPI documentation generation
  - Request logging and context
  - Lifecycle hooks and graceful shutdown
- Identify environment variables needed (JWT_SECRET, NODE_ENV, PORT)
- Document OpenAPI endpoints (/documentation, /documentation/json, /documentation/yaml)
- Note any external APIs or Firebase integration

## Output Requirements

Create an updated README.md file that:

1. **Maintains the current structure** but updates all content for accuracy
2. **Adds new sections** for any significant findings not currently documented
3. **Removes outdated information** that no longer applies (e.g., removed plugins like `support.ts`)
4. **Uses clear, concise language** appropriate for AI assistance
5. **Includes specific examples** where helpful (Fastify plugin usage, test patterns)
6. **Prioritizes information** most useful for Fastify development and Copilot

## Important Notes

- Be thorough but concise - every line should provide value
- Focus on Fastify-specific patterns and plugin architecture
- Document test coverage requirements (70% thresholds with V8 coverage)
- Include "gotchas" specific to this project:
  - ESM requires `.js` extensions on relative imports (enforced by Biome)
  - V8 ignore comments (`/* v8 ignore next -- @preserve */`) with @preserve to prevent esbuild stripping
  - Test coverage measured on unit tests only (`tests/unit/`)
  - Integration tests exist but don't affect coverage metrics
- Document both what exists AND how it should be used
- If you find discrepancies between documentation and reality, always favor reality
- Verify actual test count (should be 73 tests across 11 test files)
- Update plugin list to match actual files in `src/plugins/`

## Process

1. First, analyze the entire codebase systematically:
   - List all files in `app/src/plugins/` and `app/src/routes/`
   - Check `app/tests/unit/` and `app/tests/integration/` structure
   - Verify all npm scripts in `app/package.json`
   - Review configuration files (biome.json, vitest.config.ts, tsconfig.json)
   - Check `.github/copilot-instructions.md` for coding guidelines
2. Compare your findings with the current README.md
3. Create an updated version that reflects the true state of the Fastify project
4. Ensure all paths, commands, technical details, and plugin names are verified and accurate
5. Update test count and coverage metrics to match current state
6. Document any new plugins or routes that have been added
7. Remove references to deleted files (e.g., `support.ts` if no longer exists)

## Fastify-Specific Considerations

- Document all Fastify plugins with their purposes
- Explain the AutoLoad pattern used for plugins and routes
- Detail the plugin decorators added to Fastify instances
- Document route schemas and OpenAPI integration
- Explain test patterns for Fastify (inject method, plugin testing)
- Document lifecycle hooks and graceful shutdown
- Explain error handling with structured responses
- Detail JWT authentication flow and decorators

Remember: The goal is to create documentation that allows VS Code Copilot to work effectively with this Fastify codebase, understanding the plugin architecture, ESM requirements, and testing patterns without confusion or errors.
