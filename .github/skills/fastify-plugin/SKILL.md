---
name: fastify-plugin
description: Guide for creating Fastify plugins with TypeScript, ESM, and fastify-plugin wrapper. Use when adding new plugins to app/src/plugins/.
---

# Fastify Plugin Development

This skill provides patterns and conventions for creating Fastify plugins in this repository.

## Directory Structure

Plugins are located in `app/src/plugins/`. Each plugin is a single TypeScript file that exports a default async function wrapped with `fastify-plugin`.

## Plugin Template

```typescript
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

async function pluginName(fastify: FastifyInstance): Promise<void> {
  // Plugin implementation
}

export default fp(pluginName, {
  name: "plugin-name",
  dependencies: [], // List plugin dependencies if any
});
```

## Best Practices

1. **Always use fastify-plugin wrapper**: Wrap plugins with `fp()` to expose decorators to parent scope
2. **Declare dependencies**: List other plugins this plugin depends on in the options
3. **Type augmentation**: Extend Fastify types when adding decorators:

```typescript
declare module "fastify" {
  interface FastifyInstance {
    myDecorator: string;
  }
  interface FastifyRequest {
    customProperty: CustomType;
  }
}
```

4. **ESM imports**: Use `.js` extensions for relative imports (TypeScript compiles to ESM)
5. **Node.js builtins**: Use `node:` protocol prefix (e.g., `import * as path from "node:path"`)
6. **Type imports**: Use `import type { ... } from "pkg"` for type-only imports

## Existing Plugins Reference

- `auth.ts` - Firebase authentication with request.user decorator
- `cors.ts` - CORS configuration with @fastify/cors
- `error-handler.ts` - Global error handling with structured responses
- `firebase.ts` - Firebase Admin SDK initialization
- `helmet.ts` - Security headers with @fastify/helmet
- `lifecycle.ts` - Server lifecycle hooks and graceful shutdown
- `request-logging.ts` - Request ID and logging context
- `sensible.ts` - HTTP error utilities with @fastify/sensible
- `swagger.ts` - OpenAPI documentation with @fastify/swagger
- `under-pressure.ts` - Health checks and system pressure monitoring

## Testing Requirements

Each plugin must have a corresponding test file in `app/tests/unit/plugins/`. See the vitest-testing skill for testing patterns.

## Commands

```bash
cd app
npm run build       # Build and verify TypeScript compilation
npm run check       # Run Biome linter and formatter
npm run check:fix   # Auto-fix linting issues
npm run test        # Run all tests including plugin tests
```

## Boundaries

- Do not modify `app/src/app.ts` unless adding new AutoLoad configuration
- Do not add plugins that duplicate existing functionality
- Always add corresponding unit tests for new plugins
