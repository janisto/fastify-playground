import { describe, expect, it } from "vitest";
import { HelloService } from "../../../../src/modules/hello/index.js";

describe("HelloService", () => {
  const service = new HelloService();

  describe("greet", () => {
    it("returns default greeting without name", () => {
      const result = service.greet();
      expect(result.message).toBe("Hello, World!");
    });

    it("returns personalized greeting with name", () => {
      const result = service.greet("Alice");
      expect(result.message).toBe("Hello, Alice!");
    });
  });
});
