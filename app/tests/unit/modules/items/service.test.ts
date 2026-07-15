import { describe, expect, it } from "vitest";
import { ItemsService } from "../../../../src/modules/items/index.js";
import { encodeCursor } from "../../../../src/utils/pagination.js";

describe("ItemsService", () => {
  const service = new ItemsService();

  describe("list", () => {
    it("returns the first page with the default limit and only a next boundary", () => {
      const result = service.list({});

      expect(result.items).toHaveLength(20);
      expect(result.total).toBe(30);
      expect(result.nextCursor).toBe(encodeCursor({ type: "item", value: "item-020" }));
      expect(result.prevCursor).toBeUndefined();
    });

    it("honors a smaller page limit", () => {
      const result = service.list({ limit: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(30);
      expect(result.items.at(0)?.id).toBe("item-001");
      expect(result.items.at(4)?.id).toBe("item-005");
    });

    it("applies the category before pagination", () => {
      const result = service.list({ category: "tools" });

      expect(result.items).toHaveLength(6);
      expect(result.total).toBe(6);
      for (const item of result.items) {
        expect(item.category).toBe("tools");
      }
    });

    it("omits pagination boundaries when a filtered result fits one page", () => {
      const result = service.list({ category: "robotics", limit: 100 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.nextCursor).toBeUndefined();
      expect(result.prevCursor).toBeUndefined();
      for (const item of result.items) {
        expect(item.category).toBe("robotics");
      }
    });

    it("links the second page back to the first page sentinel", () => {
      const cursor = encodeCursor({ type: "item", value: "item-005" });
      const result = service.list({ cursor, limit: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.items.at(0)?.id).toBe("item-006");
      expect(result.prevCursor).toBeNull();
    });

    it("returns the last partial page without a next boundary", () => {
      const cursor = encodeCursor({ type: "item", value: "item-025" });
      const result = service.list({ cursor, limit: 10 });

      expect(result.items).toHaveLength(5);
      expect(result.nextCursor).toBeUndefined();
    });

    it("returns to the exact preceding page without repeating the current page", () => {
      const thirdPageCursor = encodeCursor({ type: "item", value: "item-010" });
      const thirdPage = service.list({ cursor: thirdPageCursor, limit: 5 });

      expect(thirdPage.items.map(({ id }) => id)).toEqual(["item-011", "item-012", "item-013", "item-014", "item-015"]);
      expect(thirdPage.prevCursor).toBe(encodeCursor({ type: "item", value: "item-005" }));
      if (typeof thirdPage.prevCursor !== "string") throw new Error("expected an opaque previous-page cursor");

      const previousPage = service.list({ cursor: thirdPage.prevCursor, limit: 5 });
      expect(previousPage.items.map(({ id }) => id)).toEqual([
        "item-006",
        "item-007",
        "item-008",
        "item-009",
        "item-010",
      ]);
    });
  });

  describe("validateCursor", () => {
    it("uses the first-page sentinel when the cursor is absent", () => {
      const cursor = service.validateCursor(undefined);

      expect(cursor.type).toBe("");
      expect(cursor.value).toBe("");
    });

    it("rejects malformed and empty encoded cursors", () => {
      expect(() => service.validateCursor("not-base64url!!!")).toThrow("invalid cursor format");
      expect(() => service.validateCursor(encodeCursor({ type: "", value: "" }))).toThrow("invalid cursor format");
    });

    it("rejects a cursor owned by another collection", () => {
      const wrongCursor = encodeCursor({ type: "other", value: "item-001" });
      expect(() => service.validateCursor(wrongCursor)).toThrow("cursor type mismatch");
    });

    it("accepts a canonical item cursor", () => {
      const validCursor = encodeCursor({ type: "item", value: "item-005" });
      const cursor = service.validateCursor(validCursor);

      expect(cursor.type).toBe("item");
      expect(cursor.value).toBe("item-005");
    });
  });

  describe("list with invalid cursor", () => {
    it("rejects a well-formed cursor that references unknown state", () => {
      const cursor = encodeCursor({ type: "item", value: "non-existent" });

      expect(() => service.list({ cursor })).toThrow("cursor references unknown item");
    });
  });
});
