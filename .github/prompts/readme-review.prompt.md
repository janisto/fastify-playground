---
name: 'README.md Review and Update'
description: 'Update README.md Documentation for Fastify Playground'
argument-hint: 'You are tasked with reviewing and updating the README.md file for this Fastify-based REST API project. This file provides guidance to VS Code Copilot when working with code in this repository.'
agent: 'agent'
tools: ['context7/*', 'read', 'edit']
---
# Task: Update README.md Documentation

You are tasked with reviewing and updating the README.md file for this Fastify-based REST API project. This file provides guidance to VS Code Copilot when working with code in this repository.

## Your Mission

Conduct a comprehensive analysis of the entire codebase and update the README.md file to ensure it is 100% accurate, complete, and helpful for future VS Code Copilot interactions.

## Required File Reads

Before making any updates, read these files in order:
1. `app/package.json` - Dependencies, scripts, engines
2. `app/src/app.ts` - Entry point and AutoLoad configuration
3. `app/vitest.config.ts` - Test and coverage configuration
4. `app/tsconfig.json` - TypeScript settings
5. `.github/copilot-instructions.md` - Coding guidelines
6. All files in `app/src/plugins/` and `app/src/routes/`
7. Root `biome.json` and `app/biome.json` - Linting configuration

## Analysis Requirements

### 1. Project Overview Verification
- Verify the project description matches the Fastify REST API implementation
- Check if the stated purpose aligns with actual Fastify plugins and routes
- Identify any missing key features (authentication, logging, error handling, etc.)
- Verify OpenAPI/Swagger documentation endpoints are accurate

### 2. Tech Stack Analysis
- Verify all frameworks and their versions by checking:
  - `app/package.json` for dependencies (Fastify, TypeScript, Vitest, etc.)
  - Configuration files (`biome.json`, `tsconfig.json`, `vitest.config.ts`)
- Check Node.js version in `.nvmrc` and `engines` field
- Verify Fastify plugins (@fastify/cors, @fastify/helmet, @fastify/jwt, @fastify/swagger, etc.)
- Identify any Fastify plugins used but not documented
- Remove any technologies listed but not actually used
- Verify folder structure: `app/`, `functions/` (if used)

### 3. Version Verification
- Run `cd app && npm list --depth=0` to get exact installed versions
- Verify Biome version in root `biome.json` matches documentation
- Check Vitest version matches vitest.config.ts patterns
- Ensure TypeScript version aligns with target features (5.9 for ES2024)
- Cross-reference `package-lock.json` for actual resolved versions

### 4. Commands Verification
- Verify all npm scripts in `app/package.json`:
  - `dev` (tsx watch mode)
  - `build`, `build:check`, `build:watch`
  - `test`, `test:watch`, `test:coverage`
  - `check`, `check:fix` (Biome)
  - `lint`, `lint:fix`, `format`, `format:fix`
- Document any Firebase-related commands if applicable
- Ensure command descriptions match actual behavior
- Add any missing commonly-used commands

### 5. Architecture & Directory Structure
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

### 6. Automation
- Check for GitHub Actions workflows in `.github/workflows/`
- Document any CI/CD pipelines
- Verify Firebase deployment scripts if present
- Document any build or deployment automation

### 7. Configuration Files
- Document all configuration files and their purposes:
  - `biome.json` (formatting, linting, import organization)
  - `vitest.config.ts` (test configuration, coverage thresholds)
  - `tsconfig.json` (TypeScript ES2024, NodeNext module resolution)
  - `tests/tsconfig.json` (test-specific TypeScript config)
  - `.editorconfig` (editor settings)
  - `.nvmrc` (Node.js version)
  - Environment variables (JWT_SECRET, NODE_ENV, PORT)
  - `.env.local` pattern (gitignored)

### 8. Development Guidelines
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

### 9. Integration Points
- Document Fastify plugin integrations:
  - JWT authentication flow
  - CORS origin validation
  - Helmet security headers
  - OpenAPI documentation generation
  - Request logging and context
  - Lifecycle hooks and graceful shutdown
- Note any external APIs or Firebase integration

### 10. Environment Variables Verification
- Document all required/optional environment variables by checking actual usage:
  - `JWT_SECRET` - Required for JWT authentication
  - `NODE_ENV` - development/production
  - `PORT` - Server port (default: 3000)
  - `LOG_LEVEL` - Pino log level (if used)
- Search for `process.env` usage across all source files
- Verify `.env.example` or `.env.local` patterns if present

### 11. OpenAPI Endpoints Verification
- Verify these endpoints are documented and accurate:
  - `GET /documentation` - Swagger UI
  - `GET /documentation/json` - OpenAPI JSON spec
  - `GET /documentation/yaml` - OpenAPI YAML spec
- Verify the OpenAPI version (3.1.0 vs 3.0.x) in swagger.ts

### 12. Test Count Verification
- Run `cd app && npm run test` to get current test count
- Do NOT assume a specific test count - always verify with actual execution
- Update test file count by checking `tests/unit/` and `tests/integration/` directories
- Verify coverage thresholds in `vitest.config.ts`

## Output Requirements

Create an updated README.md file that:

1. **Maintains the current structure** but updates all content for accuracy
2. **Adds new sections** for any significant findings not currently documented
3. **Removes outdated information** that no longer applies (e.g., removed plugins like `support.ts`)
4. **Uses clear, concise language** appropriate for AI assistance
5. **Includes specific examples** where helpful (Fastify plugin usage, test patterns)
6. **Prioritizes information** most useful for Fastify development and Copilot

## Markdown Quality Guidelines

- Use consistent heading levels (h2 for sections, h3 for subsections)
- Add a table of contents for README > 200 lines
- Use collapsible sections (`<details>`) for lengthy content like full command lists
- Ensure all code blocks have language identifiers (```typescript, ```bash, etc.)
- Verify all internal links work
- Use badges sparingly and only for meaningful metrics (build status, coverage)

## What NOT to Include

- Firebase-specific content if `functions/` is empty/placeholder
- Dependencies that are only devDependencies unless relevant to development workflow
- Deprecated plugins or removed features
- Speculative or planned features not yet implemented
- Hardcoded version numbers that will become stale (prefer "latest" or ranges)
- Duplicate information already in copilot-instructions.md
- Emojis or unicode symbols in code, comments, documentation, or commit messages (always refactor them away if found)

## Monorepo Awareness

- This is a monorepo with `app/` and `functions/` directories
- README.md is at root level and should primarily document `app/`
- Always clarify which directory commands should be run from
- Document root `biome.json` vs `app/biome.json` hierarchy
- Note if `functions/` is a placeholder or active

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
- Update plugin list to match actual files in `src/plugins/`

## Process

1. First, analyze the entire codebase systematically:
   - List all files in `app/src/plugins/` and `app/src/routes/`
   - Check `app/tests/unit/` and `app/tests/integration/` structure
   - Verify all npm scripts in `app/package.json`
   - Review configuration files (biome.json, vitest.config.ts, tsconfig.json)
   - Check `.github/copilot-instructions.md` for coding guidelines
2. Run `cd app && npm run test` to get actual test count
3. Run `cd app && npm list --depth=0` to verify dependency versions
4. Compare your findings with the current README.md
5. Create an updated version that reflects the true state of the Fastify project
6. Ensure all paths, commands, technical details, and plugin names are verified and accurate
7. Update test count and coverage metrics to match current state
8. Document any new plugins or routes that have been added
9. Remove references to deleted files (e.g., `support.ts` if no longer exists)

## Final Verification Checklist

After generating the updated README, verify:
- [ ] All file paths mentioned actually exist
- [ ] All npm scripts listed are valid (check `app/package.json`)
- [ ] Test count matches actual test run output
- [ ] Dependency versions are current (or described generically)
- [ ] No orphaned sections documenting non-existent features
- [ ] Plugin list matches files in `app/src/plugins/`
- [ ] Route list matches files in `app/src/routes/`
- [ ] Environment variables match actual `process.env` usage
- [ ] OpenAPI endpoints are accurate

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
