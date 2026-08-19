import { decodeCursor, encodeCursor, InvalidCursorError } from "../../utils/pagination.js";
import type { Category, Item } from "./schemas.js";

const MOCK_ITEMS: Item[] = [
  {
    id: "item-001",
    name: "Alpha Widget",
    category: "electronics",
    price: { amountMinor: 2999, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-15T10:30:00.000Z",
    description: "A versatile electronic widget for everyday use",
  },
  {
    id: "item-002",
    name: "Beta Gadget",
    category: "electronics",
    price: { amountMinor: 4999, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-16T11:00:00.000Z",
    description: "Advanced gadget with smart features",
  },
  {
    id: "item-003",
    name: "Gamma Tool",
    category: "tools",
    price: { amountMinor: 1550, currency: "USD" },
    inStock: false,
    createdAt: "2024-01-17T09:15:00.000Z",
    description: "Precision tool for professional work",
  },
  {
    id: "item-004",
    name: "Delta Component",
    category: "electronics",
    price: { amountMinor: 899, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-18T14:45:00.000Z",
    description: "Essential component for electronics projects",
  },
  {
    id: "item-005",
    name: "Epsilon Sensor",
    category: "electronics",
    price: { amountMinor: 3499, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-19T08:00:00.000Z",
    description: "High-precision environmental sensor",
  },
  {
    id: "item-006",
    name: "Zeta Cable",
    category: "accessories",
    price: { amountMinor: 1299, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-20T16:30:00.000Z",
    description: "Premium quality data cable",
  },
  {
    id: "item-007",
    name: "Eta Adapter",
    category: "accessories",
    price: { amountMinor: 999, currency: "USD" },
    inStock: false,
    createdAt: "2024-01-21T10:00:00.000Z",
    description: "Universal power adapter",
  },
  {
    id: "item-008",
    name: "Theta Board",
    category: "electronics",
    price: { amountMinor: 8999, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-22T11:30:00.000Z",
    description: "Development board for prototyping",
  },
  {
    id: "item-009",
    name: "Iota Switch",
    category: "electronics",
    price: { amountMinor: 599, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-23T09:45:00.000Z",
    description: "Tactile push button switch",
  },
  {
    id: "item-010",
    name: "Kappa Display",
    category: "electronics",
    price: { amountMinor: 4599, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-24T13:00:00.000Z",
    description: "OLED display module",
  },
  {
    id: "item-011",
    name: "Lambda Motor",
    category: "robotics",
    price: { amountMinor: 2499, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-25T08:30:00.000Z",
    description: "DC motor for robotics projects",
  },
  {
    id: "item-012",
    name: "Mu Servo",
    category: "robotics",
    price: { amountMinor: 1899, currency: "USD" },
    inStock: false,
    createdAt: "2024-01-26T15:00:00.000Z",
    description: "High-torque servo motor",
  },
  {
    id: "item-013",
    name: "Nu Battery",
    category: "power",
    price: { amountMinor: 1499, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-27T10:15:00.000Z",
    description: "Rechargeable lithium battery pack",
  },
  {
    id: "item-014",
    name: "Xi Charger",
    category: "power",
    price: { amountMinor: 2299, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-28T11:45:00.000Z",
    description: "Smart battery charger",
  },
  {
    id: "item-015",
    name: "Omicron Relay",
    category: "electronics",
    price: { amountMinor: 799, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-29T09:00:00.000Z",
    description: "5V relay module",
  },
  {
    id: "item-016",
    name: "Pi Controller",
    category: "electronics",
    price: { amountMinor: 5599, currency: "USD" },
    inStock: true,
    createdAt: "2024-01-30T14:30:00.000Z",
    description: "Microcontroller board",
  },
  {
    id: "item-017",
    name: "Rho Resistor Kit",
    category: "components",
    price: { amountMinor: 1199, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-01T08:00:00.000Z",
    description: "Assorted resistor pack",
  },
  {
    id: "item-018",
    name: "Sigma Capacitor Set",
    category: "components",
    price: { amountMinor: 1399, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-02T10:30:00.000Z",
    description: "Electrolytic capacitor assortment",
  },
  {
    id: "item-019",
    name: "Tau LED Pack",
    category: "components",
    price: { amountMinor: 699, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-03T11:00:00.000Z",
    description: "Multi-color LED assortment",
  },
  {
    id: "item-020",
    name: "Upsilon Wire Set",
    category: "accessories",
    price: { amountMinor: 899, currency: "USD" },
    inStock: false,
    createdAt: "2024-02-04T09:15:00.000Z",
    description: "Jumper wire kit",
  },
  {
    id: "item-021",
    name: "Phi Breadboard",
    category: "tools",
    price: { amountMinor: 499, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-05T13:45:00.000Z",
    description: "Solderless breadboard",
  },
  {
    id: "item-022",
    name: "Chi Soldering Iron",
    category: "tools",
    price: { amountMinor: 3599, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-06T10:00:00.000Z",
    description: "Temperature-controlled soldering station",
  },
  {
    id: "item-023",
    name: "Psi Multimeter",
    category: "tools",
    price: { amountMinor: 4299, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-07T11:30:00.000Z",
    description: "Digital multimeter with auto-ranging",
  },
  {
    id: "item-024",
    name: "Omega Oscilloscope",
    category: "tools",
    price: { amountMinor: 29999, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-08T14:00:00.000Z",
    description: "Portable digital oscilloscope",
  },
  {
    id: "item-025",
    name: "Alpha Pro Widget",
    category: "electronics",
    price: { amountMinor: 5999, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-09T08:30:00.000Z",
    description: "Professional-grade widget with extended features",
  },
  {
    id: "item-026",
    name: "Beta Max Gadget",
    category: "electronics",
    price: { amountMinor: 7999, currency: "USD" },
    inStock: false,
    createdAt: "2024-02-10T09:00:00.000Z",
    description: "Maximum performance gadget",
  },
  {
    id: "item-027",
    name: "Gamma Plus Tool",
    category: "tools",
    price: { amountMinor: 2599, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-11T10:15:00.000Z",
    description: "Enhanced precision tool",
  },
  {
    id: "item-028",
    name: "Delta Ultra Component",
    category: "electronics",
    price: { amountMinor: 1699, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-12T11:45:00.000Z",
    description: "Ultra-reliable component",
  },
  {
    id: "item-029",
    name: "Epsilon HD Sensor",
    category: "electronics",
    price: { amountMinor: 5499, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-13T13:00:00.000Z",
    description: "High-definition sensor array",
  },
  {
    id: "item-030",
    name: "Zeta Premium Cable",
    category: "accessories",
    price: { amountMinor: 1999, currency: "USD" },
    inStock: true,
    createdAt: "2024-02-14T15:30:00.000Z",
    description: "Gold-plated premium cable",
  },
];

const CURSOR_TYPE = "listItems";

interface ItemCursor {
  readonly anchor: string;
  readonly direction: "next" | "prev";
}

export interface ItemsListResult {
  items: Item[];
  total: number;
  nextCursor?: string;
  prevCursor?: string | null;
}

export class ItemsService {
  validateCursor(
    encodedCursor: string | undefined,
    expectedLimit = 20,
    expectedCategory?: Category,
  ): ItemCursor | null {
    const cursor = decodeCursor(encodedCursor);
    if (cursor === null) {
      throw new InvalidCursorError("invalid cursor format");
    }
    if (cursor.type && cursor.type !== CURSOR_TYPE) {
      throw new InvalidCursorError("cursor type mismatch");
    }
    if (!cursor.value) return null;

    const [version, direction, limitValue, categoryValue, itemId, ...extra] = cursor.value.split(":");
    const limit = Number(limitValue);
    const category = categoryValue === "*" ? undefined : categoryValue;
    if (
      extra.length > 0 ||
      version !== "1" ||
      (direction !== "next" && direction !== "prev") ||
      !itemId ||
      !Number.isSafeInteger(limit) ||
      limit !== expectedLimit ||
      category !== expectedCategory
    ) {
      throw new InvalidCursorError("cursor does not match the requested category or limit");
    }
    const canonical = encodeCursor({
      type: CURSOR_TYPE,
      value: `1:${direction}:${limit}:${category ?? "*"}:${itemId}`,
    });
    if (encodedCursor !== canonical) throw new InvalidCursorError("invalid cursor format");
    return { direction, anchor: itemId };
  }

  list(options: { cursor?: string; limit?: number; category?: Category }): ItemsListResult {
    const { cursor: encodedCursor, limit = 20, category } = options;

    const cursor = this.validateCursor(encodedCursor, limit, category);
    const filtered = category ? MOCK_ITEMS.filter((item) => item.category === category) : MOCK_ITEMS;
    const { startIndex, endIndex } = this.findPageBounds(filtered, cursor, limit);
    const pageItems = filtered.slice(startIndex, endIndex);
    const { nextCursor, prevCursor } = this.buildPaginationCursors(filtered, pageItems, startIndex, limit, category);

    return {
      items: pageItems,
      total: filtered.length,
      ...(nextCursor ? { nextCursor } : {}),
      ...(prevCursor !== undefined ? { prevCursor } : {}),
    };
  }

  private findPageBounds(
    items: Item[],
    cursor: ItemCursor | null,
    limit = 20,
  ): { startIndex: number; endIndex: number } {
    if (cursor === null) return { startIndex: 0, endIndex: limit };
    const cursorIndex = items.findIndex((item) => item.id === cursor.anchor);
    if (cursorIndex === -1) {
      throw new InvalidCursorError("cursor references unknown item");
    }
    if (
      (cursor.direction === "next" && cursorIndex === items.length - 1) ||
      (cursor.direction === "prev" && cursorIndex === 0)
    ) {
      throw new InvalidCursorError("cursor has no page in the requested direction");
    }
    if (cursor.direction === "next") {
      const startIndex = cursorIndex + 1;
      return { startIndex, endIndex: startIndex + limit };
    }
    return { startIndex: Math.max(0, cursorIndex - limit), endIndex: cursorIndex };
  }

  private buildPaginationCursors(
    items: Item[],
    pageItems: Item[],
    startIndex: number,
    limit: number,
    category: Category | undefined,
  ): { nextCursor: string | undefined; prevCursor: string | null | undefined } {
    const hasNext = startIndex + pageItems.length < items.length;
    const hasPrev = startIndex > 0;

    const lastPageItem = pageItems.at(-1);
    const firstPageItem = pageItems.at(0);
    const scope = `${limit}:${category ?? "*"}`;
    const nextCursor =
      hasNext && lastPageItem
        ? encodeCursor({ type: CURSOR_TYPE, value: `1:next:${scope}:${lastPageItem.id}` })
        : undefined;
    const prevCursor = hasPrev
      ? startIndex === limit
        ? null
        : firstPageItem
          ? encodeCursor({ type: CURSOR_TYPE, value: `1:prev:${scope}:${firstPageItem.id}` })
          : null
      : undefined;

    return { nextCursor, prevCursor };
  }
}
