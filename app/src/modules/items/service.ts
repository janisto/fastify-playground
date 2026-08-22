import { decodeCursor, encodeCursor, InvalidCursorError } from "../../utils/pagination.js";
import { ITEM_CATALOG } from "./catalog.js";
import type { Category, Item } from "./schemas.js";

const MOCK_ITEMS: readonly Item[] = ITEM_CATALOG;

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
    items: readonly Item[],
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
    items: readonly Item[],
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
