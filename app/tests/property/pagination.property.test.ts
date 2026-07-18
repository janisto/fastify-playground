import { fc, test } from "@fast-check/vitest";
import { expect } from "vitest";
import { buildLinkHeader, decodeCursor, encodeCursor } from "../../src/utils/pagination.js";
import { propertyParameters } from "./config.js";

const cursor = fc.record({
  type: fc.stringMatching(/^[A-Za-z0-9_.-]{1,32}$/),
  value: fc.oneof(
    fc.string({ minLength: 1, maxLength: 128, unit: "grapheme" }),
    fc
      .tuple(fc.string({ maxLength: 32, unit: "grapheme" }), fc.string({ maxLength: 32, unit: "grapheme" }))
      .map(([before, after]) => `${before}:${after}`),
  ),
});

test.prop([cursor], propertyParameters)("round-trips canonical Unicode cursors byte-for-byte", (input) => {
  const encoded = encodeCursor(input);
  const decoded = decodeCursor(encoded);

  expect(decoded).toEqual(input);
  expect(decoded === null ? null : encodeCursor(decoded)).toBe(encoded);
  expect(encoded).not.toContain("=");
});

const queryFields = fc.record({
  category: fc.stringMatching(/^[A-Za-z0-9 _.-]{0,32}$/),
  limit: fc.integer({ min: 1, max: 100 }).map(String),
  oldCursor: fc.stringMatching(/^[A-Za-z0-9_-]{1,32}$/),
});
const opaqueCursor = fc.stringMatching(/^[A-Za-z0-9_-]{1,64}$/);

test.prop([queryFields, opaqueCursor, opaqueCursor], propertyParameters)(
  "replaces cursors without mutating caller-owned pagination state",
  ({ category, limit, oldCursor }, nextCursor, previousCursor) => {
    const query = new URLSearchParams({ category, cursor: oldCursor, limit });
    const originalQuery = query.toString();
    const header = buildLinkHeader("/v1/items", query, nextCursor, previousCursor);
    const links = header.split(", ");
    const nextUrl = new URL(
      links
        .at(0)
        ?.match(/^<([^>]+)>/)
        ?.at(1) ?? "",
      "https://app.example",
    );
    const previousUrl = new URL(
      links
        .at(1)
        ?.match(/^<([^>]+)>/)
        ?.at(1) ?? "",
      "https://app.example",
    );

    expect(query.toString()).toBe(originalQuery);
    expect(nextUrl.searchParams.getAll("cursor")).toEqual([nextCursor]);
    expect(previousUrl.searchParams.getAll("cursor")).toEqual([previousCursor]);
    expect(nextUrl.searchParams.get("limit")).toBe(limit);
    expect(nextUrl.searchParams.get("category")).toBe(category);
    expect(previousUrl.searchParams.get("limit")).toBe(limit);
    expect(previousUrl.searchParams.get("category")).toBe(category);
  },
);

test.prop([queryFields], propertyParameters)(
  "omits the cursor when the previous link targets the first page",
  ({ category, limit, oldCursor }) => {
    const query = new URLSearchParams({ category, cursor: oldCursor, limit });
    const originalQuery = query.toString();
    const header = buildLinkHeader("/v1/items", query, undefined, null);
    const previousUrl = new URL(header.match(/^<([^>]+)>/)?.at(1) ?? "", "https://app.example");

    expect(query.toString()).toBe(originalQuery);
    expect(previousUrl.searchParams.has("cursor")).toBe(false);
    expect(previousUrl.searchParams.get("limit")).toBe(limit);
    expect(previousUrl.searchParams.get("category")).toBe(category);
  },
);
