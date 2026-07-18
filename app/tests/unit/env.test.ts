import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("environment configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("defaults", () => {
    it("uses secure and runnable defaults when variables are absent", async () => {
      delete process.env["NODE_ENV"];
      delete process.env["PORT"];
      delete process.env["HOST"];
      delete process.env["LOG_LEVEL"];
      delete process.env["CORS_ORIGINS"];

      const { env } = await import("../../src/env.js");

      expect(env.NODE_ENV).toBe("development");
      expect(env.PORT).toBe(3000);
      expect(env.HOST).toBe("0.0.0.0");
      expect(env.LOG_LEVEL).toBe("info");
      expect(env.CORS_ORIGINS).toEqual([]);
    });
  });

  describe("decoding", () => {
    it("decodes the runtime mode", async () => {
      process.env["NODE_ENV"] = "production";

      const { env } = await import("../../src/env.js");

      expect(env.NODE_ENV).toBe("production");
    });

    it("converts the port to a number", async () => {
      process.env["PORT"] = "8080";

      const { env } = await import("../../src/env.js");

      expect(env.PORT).toBe(8080);
      expect(typeof env.PORT).toBe("number");
    });

    it("preserves the listening host", async () => {
      process.env["HOST"] = "127.0.0.1";

      const { env } = await import("../../src/env.js");

      expect(env.HOST).toBe("127.0.0.1");
    });

    it("decodes the log level", async () => {
      process.env["LOG_LEVEL"] = "debug";

      const { env } = await import("../../src/env.js");

      expect(env.LOG_LEVEL).toBe("debug");
    });

    it("accepts the test runtime mode", async () => {
      process.env["NODE_ENV"] = "test";

      const { env } = await import("../../src/env.js");

      expect(env.NODE_ENV).toBe("test");
    });

    it("does not expose the test-only GitHub token to runtime configuration", async () => {
      process.env["GITHUB_TOKEN"] = "private-resource-capable-canary";

      const { env } = await import("../../src/env.js");

      expect("GITHUB_TOKEN" in env).toBe(false);
    });
  });

  describe("log levels", () => {
    it.each(["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const)("accepts %s", async (level) => {
      vi.resetModules();
      process.env["LOG_LEVEL"] = level;

      const { env } = await import("../../src/env.js");

      expect(env.LOG_LEVEL).toBe(level);
    });
  });

  describe("invalid values", () => {
    it("rejects an unknown runtime mode", async () => {
      process.env["NODE_ENV"] = "invalid";

      await expect(import("../../src/env.js")).rejects.toThrow();
    });

    it("rejects an unknown log level", async () => {
      process.env["LOG_LEVEL"] = "invalid";

      await expect(import("../../src/env.js")).rejects.toThrow();
    });

    it.each(["not-a-number", "0", "65536"])("rejects an unusable port %s", async (port) => {
      process.env["PORT"] = port;

      await expect(import("../../src/env.js")).rejects.toThrow();
    });

    it("rejects an empty listening host", async () => {
      process.env["HOST"] = "";

      await expect(import("../../src/env.js")).rejects.toThrow();
    });
  });

  describe("CORS origins", () => {
    it.each([
      ['["http://localhost:3000", "https://app.example.com/"]', ["http://localhost:3000", "https://app.example.com"]],
      ['["http://app.example:80", "https://app.example:443"]', ["http://app.example", "https://app.example"]],
      [
        "http://localhost:3000, https://app.example.com, http://localhost:3000",
        ["http://localhost:3000", "https://app.example.com"],
      ],
    ])("parses and normalizes %s", async (raw, expected) => {
      process.env["CORS_ORIGINS"] = raw;

      const { env } = await import("../../src/env.js");

      expect(env.CORS_ORIGINS).toEqual(expected);
    });

    it.each([
      ["malformed JSON", "[invalid"],
      ["JSON object", '{"origin":"https://app.example.com"}'],
      ["non-string entry", '["https://app.example.com", 42]'],
      ["wildcard", "*"],
      ["non-HTTP scheme", "file:///tmp/example"],
      ["path", "https://app.example.com/path"],
      ["query", "https://app.example.com?tenant=1"],
      ["credentials", "https://user:pass@app.example.com"],
    ])("rejects a %s", async (_case, raw) => {
      process.env["CORS_ORIGINS"] = raw;

      await expect(import("../../src/env.js")).rejects.toThrow();
    });
  });
});
