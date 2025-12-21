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
  });
});
