import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",

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

			// Thresholds per guidelines (70%+ overall)
			thresholds: {
				lines: 70,
				functions: 70,
				branches: 70,
				statements: 70,
				perFile: false, // Enforce globally, not per-file
			},

			// Exclude patterns
			exclude: [
				"**/coverage/**",
				"**/dist/**",
				"**/node_modules/**",
				"**/tests/**",
				"**/types/**",
				"**/app.ts", // Entry point with AutoLoad, tested via integration
			],

			// Include all source files
			include: ["src/**/*.ts"],
		},

		// Type checking (optional, costs performance)
		typecheck: {
			enabled: false,
		},
	},
});
