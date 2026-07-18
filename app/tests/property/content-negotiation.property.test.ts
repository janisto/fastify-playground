import { fc, test } from "@fast-check/vitest";
import { expect } from "vitest";
import { CBOR_MEDIA_TYPE, JSON_MEDIA_TYPE, negotiateApiMediaType } from "../../src/utils/content-negotiation.js";
import { propertyParameters } from "./config.js";

function quality(value: number): string {
  return value === 1000 ? "1" : `0.${value.toString().padStart(3, "0")}`;
}

function mixedCase(value: string, upper: boolean): string {
  return upper ? value.toUpperCase() : value;
}

test.prop(
  [fc.integer({ min: 1, max: 999 }), fc.integer({ min: 1, max: 999 }), fc.boolean(), fc.boolean()],
  propertyParameters,
)(
  "selects the highest-quality explicit media type independent of case and range order",
  (jsonQ, cborQ, reverse, upper) => {
    fc.pre(jsonQ !== cborQ);
    const ranges = [
      `${mixedCase(JSON_MEDIA_TYPE, upper)} ; q=${quality(jsonQ)}`,
      `${mixedCase(CBOR_MEDIA_TYPE, !upper)};q=${quality(cborQ)}`,
    ];
    const header = (reverse ? ranges.toReversed() : ranges).join(" , ");

    expect(negotiateApiMediaType(header)).toBe(jsonQ > cborQ ? JSON_MEDIA_TYPE : CBOR_MEDIA_TYPE);
  },
);

test.prop([fc.integer({ min: 1, max: 1000 }), fc.boolean()], propertyParameters)(
  "uses server order for equal quality and never selects CBOR from a wildcard",
  (q, reverse) => {
    const ranges = [`${JSON_MEDIA_TYPE};q=${quality(q)}`, `${CBOR_MEDIA_TYPE};q=${quality(q)}`];
    const header = (reverse ? ranges.toReversed() : ranges).join(",");

    expect(negotiateApiMediaType(header)).toBe(JSON_MEDIA_TYPE);
    expect(negotiateApiMediaType(`*/*;q=${quality(q)}`)).toBe(JSON_MEDIA_TYPE);
  },
);

test.prop([fc.constantFrom("", " ", "\t")], propertyParameters)(
  "honors a specific JSON exclusion over an allowed wildcard",
  (space) => {
    const header = `*/*${space};${space}q=1,${space}application/json${space};${space}q=0`;

    expect(negotiateApiMediaType(header)).toBeNull();
  },
);
