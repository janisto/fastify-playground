import { PassThrough } from "node:stream";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import logging, {
  buildTraceFields,
  parseTraceparent,
  type TraceparentComponents,
} from "../../../src/plugins/logging.js";
import requestid from "../../../src/plugins/requestid.js";

function collectLogs() {
  const stream = new PassThrough();
  const lines: string[] = [];
  stream.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) lines.push(line);
    }
  });
  return { stream, lines };
}

function parseLogMessages(lines: string[]): { msg: string }[] {
  return lines.map((line) => JSON.parse(line) as { msg: string });
}

describe("Request Logging Plugin", () => {
  it("should log incoming requests", async () => {
    const { stream, lines } = collectLogs();
    const fastify = Fastify({
      disableRequestLogging: true,
      logger: { stream, level: "info" },
    });

    await fastify.register(requestid);
    await fastify.register(logging);

    fastify.get("/test", async () => ({ status: "ok" }));

    const response = await fastify.inject({
      method: "GET",
      url: "/test",
    });

    expect(response.statusCode).toBe(200);

    await fastify.close();

    const parsed = parseLogMessages(lines);
    const requestLogs = parsed.filter((entry) => entry.msg === "Incoming request" || entry.msg === "Request completed");
    expect(requestLogs).toHaveLength(2);
    expect(requestLogs[0].msg).toBe("Incoming request");
    expect(requestLogs[1].msg).toBe("Request completed");
  });

  it("should not emit duplicate request logs", async () => {
    const { stream, lines } = collectLogs();
    const fastify = Fastify({
      disableRequestLogging: true,
      logger: { stream, level: "info" },
    });

    await fastify.register(requestid);
    await fastify.register(logging);

    fastify.get("/test", async () => ({ status: "ok" }));

    await fastify.inject({ method: "GET", url: "/test" });
    await fastify.close();

    const parsed = parseLogMessages(lines);
    const incomingLogs = parsed.filter((e) => e.msg.toLowerCase().includes("incoming request"));
    const completedLogs = parsed.filter((e) => e.msg.toLowerCase().includes("request completed"));

    expect(incomingLogs).toHaveLength(1);
    expect(completedLogs).toHaveLength(1);
  });

  it("should include structured fields in request logs", async () => {
    const { stream, lines } = collectLogs();
    const fastify = Fastify({
      disableRequestLogging: true,
      logger: { stream, level: "info" },
    });

    await fastify.register(requestid);
    await fastify.register(logging);

    fastify.get("/test", async () => ({ status: "ok" }));

    await fastify.inject({
      method: "GET",
      url: "/test",
      headers: { "user-agent": "test-agent" },
    });
    await fastify.close();

    const parsed = lines.map((line) => JSON.parse(line));
    const incoming = parsed.find((e: { msg: string }) => e.msg === "Incoming request");
    const completed = parsed.find((e: { msg: string }) => e.msg === "Request completed");

    expect(incoming).toMatchObject({
      method: "GET",
      url: "/test",
      userAgent: "test-agent",
    });
    expect(incoming.requestId).toBeDefined();

    expect(completed).toMatchObject({
      method: "GET",
      url: "/test",
      statusCode: 200,
    });
    expect(completed.responseTime).toBeGreaterThanOrEqual(0);
    expect(completed.requestId).toBeDefined();
  });
});

describe("W3C Trace Context (traceparent) utilities", () => {
  describe("parseTraceparent", () => {
    it("should parse valid traceparent header with sampled flag", () => {
      const traceparent = "00-ab42124a3c573678d4d8b21ba52df3bf-d21f7bc17caa5aba-01";
      const result = parseTraceparent(traceparent);

      expect(result).not.toBeNull();
      expect(result?.version).toBe("00");
      expect(result?.traceId).toBe("ab42124a3c573678d4d8b21ba52df3bf");
      expect(result?.spanId).toBe("d21f7bc17caa5aba");
      expect(result?.traceFlags).toBe("01");
      expect(result?.sampled).toBe(true);
    });

    it("should parse valid traceparent header with unsampled flag", () => {
      const traceparent = "00-ab42124a3c573678d4d8b21ba52df3bf-d21f7bc17caa5aba-00";
      const result = parseTraceparent(traceparent);

      expect(result).not.toBeNull();
      expect(result?.sampled).toBe(false);
    });

    it("should handle uppercase hex characters", () => {
      const traceparent = "00-AB42124A3C573678D4D8B21BA52DF3BF-D21F7BC17CAA5ABA-01";
      const result = parseTraceparent(traceparent);

      expect(result).not.toBeNull();
      expect(result?.traceId).toBe("AB42124A3C573678D4D8B21BA52DF3BF");
      expect(result?.spanId).toBe("D21F7BC17CAA5ABA");
    });

    it("should return null for undefined header", () => {
      const result = parseTraceparent(undefined);
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = parseTraceparent("");
      expect(result).toBeNull();
    });

    it("should return null for invalid format", () => {
      const result = parseTraceparent("invalid-traceparent-format");
      expect(result).toBeNull();
    });

    it("should return null for wrong version format", () => {
      const result = parseTraceparent("xx-ab42124a3c573678d4d8b21ba52df3bf-d21f7bc17caa5aba-01");
      expect(result).toBeNull();
    });

    it("should return null for wrong trace-id length (too short)", () => {
      const result = parseTraceparent("00-ab42124a3c573678-d21f7bc17caa5aba-01");
      expect(result).toBeNull();
    });

    it("should return null for wrong parent-id length (too short)", () => {
      const result = parseTraceparent("00-ab42124a3c573678d4d8b21ba52df3bf-d21f7bc1-01");
      expect(result).toBeNull();
    });

    it("should return null for trace-id with invalid characters", () => {
      const result = parseTraceparent("00-gg42124a3c573678d4d8b21ba52df3bf-d21f7bc17caa5aba-01");
      expect(result).toBeNull();
    });

    it("should return null for parent-id with invalid characters", () => {
      const result = parseTraceparent("00-ab42124a3c573678d4d8b21ba52df3bf-zz1f7bc17caa5aba-01");
      expect(result).toBeNull();
    });

    it("should return null for missing parts", () => {
      expect(parseTraceparent("00-ab42124a3c573678d4d8b21ba52df3bf-d21f7bc17caa5aba")).toBeNull();
      expect(parseTraceparent("00-ab42124a3c573678d4d8b21ba52df3bf")).toBeNull();
      expect(parseTraceparent("00")).toBeNull();
    });
  });

  describe("buildTraceFields", () => {
    const validTraceparent: TraceparentComponents = {
      version: "00",
      traceId: "ab42124a3c573678d4d8b21ba52df3bf",
      spanId: "d21f7bc17caa5aba",
      traceFlags: "01",
      sampled: true,
    };

    it("should build trace fields when both traceparent and projectId are provided", () => {
      const result = buildTraceFields(validTraceparent, "my-project");

      expect(result["logging.googleapis.com/trace"]).toBe(
        "projects/my-project/traces/ab42124a3c573678d4d8b21ba52df3bf",
      );
      expect(result["logging.googleapis.com/spanId"]).toBe("d21f7bc17caa5aba");
      expect(result["logging.googleapis.com/trace_sampled"]).toBe(true);
    });

    it("should set trace_sampled to false when sampled is false", () => {
      const unsampledTraceparent: TraceparentComponents = {
        ...validTraceparent,
        traceFlags: "00",
        sampled: false,
      };
      const result = buildTraceFields(unsampledTraceparent, "my-project");

      expect(result["logging.googleapis.com/trace_sampled"]).toBe(false);
    });

    it("should return empty object when traceparent is null", () => {
      const result = buildTraceFields(null, "my-project");
      expect(result).toEqual({});
    });

    it("should return empty object when projectId is undefined", () => {
      const result = buildTraceFields(validTraceparent, undefined);
      expect(result).toEqual({});
    });

    it("should return empty object when projectId is empty string", () => {
      const result = buildTraceFields(validTraceparent, "");
      expect(result).toEqual({});
    });

    it("should return empty object when both are missing", () => {
      const result = buildTraceFields(null, undefined);
      expect(result).toEqual({});
    });

    it("should preserve trace-id case from input", () => {
      const uppercaseTraceparent: TraceparentComponents = {
        ...validTraceparent,
        traceId: "AB42124A3C573678D4D8B21BA52DF3BF",
      };
      const result = buildTraceFields(uppercaseTraceparent, "my-project");

      expect(result["logging.googleapis.com/trace"]).toBe(
        "projects/my-project/traces/AB42124A3C573678D4D8B21BA52DF3BF",
      );
    });
  });
});
