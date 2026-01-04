import { describe, expect, it } from "vitest";
import { ItemsService } from "../../../../src/modules/items/index.js";
import { encodeCursor } from "../../../../src/utils/pagination.js";

describe("ItemsService", () => {
  const service = new ItemsService();

  describe("list", () => {
    it("returns paginated list of items with default limit", () => {
      const result = service.list({});

      expect(result.items).toBeDefined();
      expect(result.items).toHaveLength(20);
      expect(result.total).toBe(30);
      expect(result.nextCursor).toBeDefined();
      expect(result.prevCursor).toBeUndefined();
    });

    it("returns items with custom limit", () => {
      const result = service.list({ limit: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(30);
      expect(result.items[0].id).toBe("item-001");
      expect(result.items[4].id).toBe("item-005");
    });

    it("filters items by category", () => {
      const result = service.list({ category: "tools" });

      expect(result.items).toHaveLength(6);
      expect(result.total).toBe(6);
      for (const item of result.items) {
        expect(item.category).toBe("tools");
      }
    });

    it("filters items by category with fewer results", () => {
      const result = service.list({ category: "robotics", limit: 100 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      for (const item of result.items) {
        expect(item.category).toBe("robotics");
      }
    });

    it("paginates with cursor", () => {
      const cursor = encodeCursor({ type: "item", value: "item-005" });
      const result = service.list({ cursor, limit: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.items[0].id).toBe("item-006");
      expect(result.prevCursor).toBeDefined();
    });

    it("returns no next cursor on last page", () => {
      const cursor = encodeCursor({ type: "item", value: "item-025" });
      const result = service.list({ cursor, limit: 10 });

      expect(result.items).toHaveLength(5);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe("validateCursor", () => {
    it("returns empty cursor for undefined input", () => {
      const cursor = service.validateCursor(undefined);

      expect(cursor.type).toBe("");
      expect(cursor.value).toBe("");
    });

    it("throws error for invalid cursor format", () => {
      expect(() => service.validateCursor("not-base64url!!!")).toThrow("invalid cursor format");
    });

    it("throws error for cursor type mismatch", () => {
      const wrongCursor = encodeCursor({ type: "other", value: "item-001" });
      expect(() => service.validateCursor(wrongCursor)).toThrow("cursor type mismatch");
    });

    it("accepts valid cursor", () => {
      const validCursor = encodeCursor({ type: "item", value: "item-005" });
      const cursor = service.validateCursor(validCursor);

      expect(cursor.type).toBe("item");
      expect(cursor.value).toBe("item-005");
    });
  });

  describe("list with invalid cursor", () => {
    it("throws error for cursor referencing unknown item", () => {
      const cursor = encodeCursor({ type: "item", value: "non-existent" });

      expect(() => service.list({ cursor })).toThrow("cursor references unknown item");
    });
  });
});
