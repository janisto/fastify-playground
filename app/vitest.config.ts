import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      CORS_ORIGINS: "http://localhost:3000",
      LOG_LEVEL: "silent",
    },

    // Test file patterns per guidelines
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/.{git,cache,output,temp}/**"],

    // Mock behavior
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Isolation
    isolate: true,

    // Coverage configuration
    coverage: {
      provider: "v8",
      enabled: false, // Enable via --coverage flag

      // Reporters
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      reportsDirectory: "./coverage",

      // Enforce meaningful global coverage across the full test suite.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
        perFile: false,
      },

      // Exclude patterns
      exclude: ["**/coverage/**", "**/dist/**", "**/node_modules/**", "**/tests/**", "**/types/**"],

      // Include all source files
      include: ["src/**/*.ts"],
    },

    // Type checking (optional, costs performance)
    typecheck: {
      enabled: false,
    },
  },
});
