import { describe, expect, it } from "vitest";
import { ItemsService } from "../../../../src/modules/items/index.js";
import { encodeCursor } from "../../../../src/utils/pagination.js";

const EXPECTED_CATALOG = [
  [
    "item-001",
    "Alpha Widget",
    "electronics",
    2999,
    true,
    "2024-01-15T10:30:00.000Z",
    "A versatile electronic widget for everyday use",
  ],
  [
    "item-002",
    "Beta Gadget",
    "electronics",
    4999,
    true,
    "2024-01-16T11:00:00.000Z",
    "Advanced gadget with smart features",
  ],
  ["item-003", "Gamma Tool", "tools", 1550, false, "2024-01-17T09:15:00.000Z", "Precision tool for professional work"],
  [
    "item-004",
    "Delta Component",
    "electronics",
    899,
    true,
    "2024-01-18T14:45:00.000Z",
    "Essential component for electronics projects",
  ],
  [
    "item-005",
    "Epsilon Sensor",
    "electronics",
    3499,
    true,
    "2024-01-19T08:00:00.000Z",
    "High-precision environmental sensor",
  ],
  ["item-006", "Zeta Cable", "accessories", 1299, true, "2024-01-20T16:30:00.000Z", "Premium quality data cable"],
  ["item-007", "Eta Adapter", "accessories", 999, false, "2024-01-21T10:00:00.000Z", "Universal power adapter"],
  [
    "item-008",
    "Theta Board",
    "electronics",
    8999,
    true,
    "2024-01-22T11:30:00.000Z",
    "Development board for prototyping",
  ],
  ["item-009", "Iota Switch", "electronics", 599, true, "2024-01-23T09:45:00.000Z", "Tactile push button switch"],
  ["item-010", "Kappa Display", "electronics", 4599, true, "2024-01-24T13:00:00.000Z", "OLED display module"],
  ["item-011", "Lambda Motor", "robotics", 2499, true, "2024-01-25T08:30:00.000Z", "DC motor for robotics projects"],
  ["item-012", "Mu Servo", "robotics", 1899, false, "2024-01-26T15:00:00.000Z", "High-torque servo motor"],
  ["item-013", "Nu Battery", "power", 1499, true, "2024-01-27T10:15:00.000Z", "Rechargeable lithium battery pack"],
  ["item-014", "Xi Charger", "power", 2299, true, "2024-01-28T11:45:00.000Z", "Smart battery charger"],
  ["item-015", "Omicron Relay", "electronics", 799, true, "2024-01-29T09:00:00.000Z", "5V relay module"],
  ["item-016", "Pi Controller", "electronics", 5599, true, "2024-01-30T14:30:00.000Z", "Microcontroller board"],
  ["item-017", "Rho Resistor Kit", "components", 1199, true, "2024-02-01T08:00:00.000Z", "Assorted resistor pack"],
  [
    "item-018",
    "Sigma Capacitor Set",
    "components",
    1399,
    true,
    "2024-02-02T10:30:00.000Z",
    "Electrolytic capacitor assortment",
  ],
  ["item-019", "Tau LED Pack", "components", 699, true, "2024-02-03T11:00:00.000Z", "Multi-color LED assortment"],
  ["item-020", "Upsilon Wire Set", "accessories", 899, false, "2024-02-04T09:15:00.000Z", "Jumper wire kit"],
  ["item-021", "Phi Breadboard", "tools", 499, true, "2024-02-05T13:45:00.000Z", "Solderless breadboard"],
  [
    "item-022",
    "Chi Soldering Iron",
    "tools",
    3599,
    true,
    "2024-02-06T10:00:00.000Z",
    "Temperature-controlled soldering station",
  ],
  [
    "item-023",
    "Psi Multimeter",
    "tools",
    4299,
    true,
    "2024-02-07T11:30:00.000Z",
    "Digital multimeter with auto-ranging",
  ],
  ["item-024", "Omega Oscilloscope", "tools", 29999, true, "2024-02-08T14:00:00.000Z", "Portable digital oscilloscope"],
  [
    "item-025",
    "Alpha Pro Widget",
    "electronics",
    5999,
    true,
    "2024-02-09T08:30:00.000Z",
    "Professional-grade widget with extended features",
  ],
  ["item-026", "Beta Max Gadget", "electronics", 7999, false, "2024-02-10T09:00:00.000Z", "Maximum performance gadget"],
  ["item-027", "Gamma Plus Tool", "tools", 2599, true, "2024-02-11T10:15:00.000Z", "Enhanced precision tool"],
  [
    "item-028",
    "Delta Ultra Component",
    "electronics",
    1699,
    true,
    "2024-02-12T11:45:00.000Z",
    "Ultra-reliable component",
  ],
  [
    "item-029",
    "Epsilon HD Sensor",
    "electronics",
    5499,
    true,
    "2024-02-13T13:00:00.000Z",
    "High-definition sensor array",
  ],
  [
    "item-030",
    "Zeta Premium Cable",
    "accessories",
    1999,
    true,
    "2024-02-14T15:30:00.000Z",
    "Gold-plated premium cable",
  ],
] as const;

const CATEGORIES = ["electronics", "tools", "accessories", "robotics", "power", "components"] as const;

describe("ItemsService", () => {
  const service = new ItemsService();

  describe("list", () => {
    it("returns the first page with the default limit and only a next boundary", () => {
      const result = service.list({});

      expect(result.items).toHaveLength(20);
      expect(result.total).toBe(30);
      expect(result.nextCursor).toBe(encodeCursor({ type: "listItems", value: "1:next:20:*:item-020" }));
      expect(result.prevCursor).toBeUndefined();
    });

    it("returns the exact fixed portable catalog", () => {
      const result = service.list({ limit: 100 });

      expect(
        result.items.map((item) => [
          item.id,
          item.name,
          item.category,
          item.price.amountMinor,
          item.inStock,
          item.createdAt,
          item.description,
        ]),
      ).toEqual(EXPECTED_CATALOG);
      expect(result.items.every((item) => item.price.currency === "USD")).toBe(true);
      expect(result.total).toBe(30);
    });

    it.each(CATEGORIES)("returns the exact ordered %s subset and filtered total", (category) => {
      const result = service.list({ category, limit: 100 });
      const expectedIds = EXPECTED_CATALOG.filter((item) => item[2] === category).map((item) => item[0]);

      expect(result.items.map((item) => item.id)).toEqual(expectedIds);
      expect(result.total).toBe(expectedIds.length);
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
      const cursor = encodeCursor({ type: "listItems", value: "1:next:5:*:item-005" });
      const result = service.list({ cursor, limit: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.items.at(0)?.id).toBe("item-006");
      expect(result.prevCursor).toBeNull();
    });

    it("returns the last partial page without a next boundary", () => {
      const cursor = encodeCursor({ type: "listItems", value: "1:next:10:*:item-025" });
      const result = service.list({ cursor, limit: 10 });

      expect(result.items).toHaveLength(5);
      expect(result.nextCursor).toBeUndefined();
    });

    it("returns to the exact preceding page without repeating the current page", () => {
      const thirdPageCursor = encodeCursor({ type: "listItems", value: "1:next:5:*:item-010" });
      const thirdPage = service.list({ cursor: thirdPageCursor, limit: 5 });

      expect(thirdPage.items.map(({ id }) => id)).toEqual(["item-011", "item-012", "item-013", "item-014", "item-015"]);
      expect(thirdPage.prevCursor).toBe(encodeCursor({ type: "listItems", value: "1:prev:5:*:item-011" }));
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

    it("keeps a valid unaligned anchor non-overlapping in both directions", () => {
      const cursor = encodeCursor({ type: "listItems", value: "1:next:5:*:item-003" });
      const current = service.list({ cursor, limit: 5 });

      expect(current.items.map(({ id }) => id)).toEqual(["item-004", "item-005", "item-006", "item-007", "item-008"]);
      expect(typeof current.prevCursor).toBe("string");
      if (typeof current.prevCursor !== "string") throw new Error("expected an opaque previous-page cursor");

      const previous = service.list({ cursor: current.prevCursor, limit: 5 });
      expect(previous.items.map(({ id }) => id)).toEqual(["item-001", "item-002", "item-003"]);
      expect(previous.nextCursor).toBe(cursor);
    });
  });

  describe("validateCursor", () => {
    it("uses the first-page sentinel when the cursor is absent", () => {
      const cursor = service.validateCursor(undefined);

      expect(cursor).toBeNull();
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
      const validCursor = encodeCursor({ type: "listItems", value: "1:next:20:*:item-005" });
      const cursor = service.validateCursor(validCursor);

      expect(cursor).toEqual({ direction: "next", anchor: "item-005" });
    });

    it.each(["020", "2e1"])("rejects a noncanonical decoded limit %s", (limit) => {
      const cursor = encodeCursor({ type: "listItems", value: `1:next:${limit}:*:item-005` });

      expect(() => service.validateCursor(cursor)).toThrow("invalid cursor format");
    });

    it("rejects a cursor when the client changes its limit or category scope", () => {
      const cursor = encodeCursor({ type: "listItems", value: "1:next:5:tools:item-003" });

      expect(() => service.validateCursor(cursor, 10, "tools")).toThrow(
        "cursor does not match the requested category or limit",
      );
      expect(() => service.validateCursor(cursor, 5, "electronics")).toThrow(
        "cursor does not match the requested category or limit",
      );
    });
  });

  describe("list with invalid cursor", () => {
    it("rejects a well-formed cursor that references unknown state", () => {
      const cursor = encodeCursor({ type: "listItems", value: "1:next:20:*:non-existent" });

      expect(() => service.list({ cursor })).toThrow("cursor references unknown item");
    });

    it.each([
      ["next", "item-030"],
      ["prev", "item-001"],
    ] as const)("rejects an impossible %s boundary", (direction, anchor) => {
      const cursor = encodeCursor({ type: "listItems", value: `1:${direction}:20:*:${anchor}` });

      expect(() => service.list({ cursor })).toThrow("cursor has no page in the requested direction");
    });
  });
});
