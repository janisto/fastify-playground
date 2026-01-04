import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Environment Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Default Values", () => {
    it("should use default values when environment variables are not set", async () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.HOST;
      delete process.env.LOG_LEVEL;

      const { env } = await import("../../src/env.js");

      expect(env.NODE_ENV).toBe("development");
      expect(env.PORT).toBe(3000);
      expect(env.HOST).toBe("0.0.0.0");
      expect(env.LOG_LEVEL).toBe("info");
    });
  });

  describe("Environment Variable Parsing", () => {
    it("should parse NODE_ENV correctly", async () => {
      process.env.NODE_ENV = "production";

      const { env } = await import("../../src/env.js");

      expect(env.NODE_ENV).toBe("production");
    });

    it("should parse PORT as a number", async () => {
      process.env.PORT = "8080";

      const { env } = await import("../../src/env.js");

      expect(env.PORT).toBe(8080);
      expect(typeof env.PORT).toBe("number");
    });

    it("should parse HOST correctly", async () => {
      process.env.HOST = "127.0.0.1";

      const { env } = await import("../../src/env.js");

      expect(env.HOST).toBe("127.0.0.1");
    });

    it("should parse LOG_LEVEL correctly", async () => {
      process.env.LOG_LEVEL = "debug";

      const { env } = await import("../../src/env.js");

      expect(env.LOG_LEVEL).toBe("debug");
    });

    it("should accept test as NODE_ENV", async () => {
      process.env.NODE_ENV = "test";

      const { env } = await import("../../src/env.js");

      expect(env.NODE_ENV).toBe("test");
    });
  });

  describe("LOG_LEVEL Values", () => {
    it.each([
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ] as const)("should accept %s as LOG_LEVEL", async (level) => {
      vi.resetModules();
      process.env.LOG_LEVEL = level;

      const { env } = await import("../../src/env.js");

      expect(env.LOG_LEVEL).toBe(level);
    });
  });

  describe("Type Exports", () => {
    it("should export env object with correct shape", async () => {
      const { env } = await import("../../src/env.js");

      expect(env).toHaveProperty("NODE_ENV");
      expect(env).toHaveProperty("PORT");
      expect(env).toHaveProperty("HOST");
      expect(env).toHaveProperty("LOG_LEVEL");
      expect(env).toHaveProperty("SECRET_MANAGER_ENABLED");
      expect(env).toHaveProperty("APP_ENVIRONMENT");
      expect(env).toHaveProperty("APP_URL");
    });

    it("should have optional Firebase properties", async () => {
      process.env.FIREBASE_PROJECT_ID = "test-project";
      process.env.FIREBASE_PROJECT_NUMBER = "123456789";

      const { env } = await import("../../src/env.js");

      expect(env.FIREBASE_PROJECT_ID).toBe("test-project");
      expect(env.FIREBASE_PROJECT_NUMBER).toBe("123456789");
    });
  });

  describe("Invalid Values", () => {
    it("should throw for invalid NODE_ENV", async () => {
      process.env.NODE_ENV = "invalid";

      await expect(import("../../src/env.js")).rejects.toThrow();
    });

    it("should throw for invalid LOG_LEVEL", async () => {
      process.env.LOG_LEVEL = "invalid";

      await expect(import("../../src/env.js")).rejects.toThrow();
    });

    it("should throw for non-numeric PORT", async () => {
      process.env.PORT = "not-a-number";

      await expect(import("../../src/env.js")).rejects.toThrow();
    });

    it("should throw for invalid APP_ENVIRONMENT", async () => {
      process.env.APP_ENVIRONMENT = "invalid";

      await expect(import("../../src/env.js")).rejects.toThrow();
    });
  });

  describe("New Environment Variables", () => {
    it("should use default values for new variables", async () => {
      delete process.env.SECRET_MANAGER_ENABLED;
      delete process.env.APP_ENVIRONMENT;
      delete process.env.APP_URL;

      const { env } = await import("../../src/env.js");

      expect(env.SECRET_MANAGER_ENABLED).toBe(false);
      expect(env.APP_ENVIRONMENT).toBe("development");
      expect(env.APP_URL).toBe("http://localhost:3000");
    });

    it("should parse SECRET_MANAGER_ENABLED as boolean", async () => {
      process.env.SECRET_MANAGER_ENABLED = "true";

      const { env } = await import("../../src/env.js");

      expect(env.SECRET_MANAGER_ENABLED).toBe(true);
      expect(typeof env.SECRET_MANAGER_ENABLED).toBe("boolean");
    });

    it("should parse APP_ENVIRONMENT correctly", async () => {
      process.env.APP_ENVIRONMENT = "staging";

      const { env } = await import("../../src/env.js");

      expect(env.APP_ENVIRONMENT).toBe("staging");
    });

    it("should parse APP_URL correctly", async () => {
      process.env.APP_URL = "https://api.example.com";

      const { env } = await import("../../src/env.js");

      expect(env.APP_URL).toBe("https://api.example.com");
    });

    it.each([
      "development",
      "staging",
      "production",
    ] as const)("should accept %s as APP_ENVIRONMENT", async (environment) => {
      vi.resetModules();
      process.env.APP_ENVIRONMENT = environment;

      const { env } = await import("../../src/env.js");

      expect(env.APP_ENVIRONMENT).toBe(environment);
    });
  });
});
