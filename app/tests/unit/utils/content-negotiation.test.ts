import { describe, expect, it } from "vitest";
import {
  acceptsMediaType,
  CBOR_MEDIA_TYPE,
  contentTypeMatches,
  JSON_MEDIA_TYPE,
  negotiateApiMediaType,
  negotiateMediaType,
  negotiateProblemMediaType,
  normalizeMediaType,
  PROBLEM_JSON_MEDIA_TYPE,
} from "../../../src/utils/content-negotiation.js";

describe("content negotiation", () => {
  it("normalizes media types case-insensitively and removes parameters", () => {
    expect(normalizeMediaType(" Application/CBOR ; profile=example ")).toBe(CBOR_MEDIA_TYPE);
  });

  it.each([
    ["application/json", JSON_MEDIA_TYPE, false, true],
    ["application/*", JSON_MEDIA_TYPE, false, true],
    ["*/*", JSON_MEDIA_TYPE, false, true],
    ["*/*", CBOR_MEDIA_TYPE, true, false],
    ["*/*;q=1, application/json;q=0", JSON_MEDIA_TYPE, false, false],
    ["application/json;profile=example", JSON_MEDIA_TYPE, false, false],
    ["application/json;q=1.0000", JSON_MEDIA_TYPE, false, false],
    ["application/json;q=1.001", JSON_MEDIA_TYPE, false, false],
    ["application/json;q=0.123", JSON_MEDIA_TYPE, false, true],
  ])("evaluates %s for %s", (accept, mediaType, explicitOnly, expected) => {
    expect(acceptsMediaType(accept, mediaType, explicitOnly)).toBe(expected);
  });

  it.each([
    ["", JSON_MEDIA_TYPE],
    ["*/*", JSON_MEDIA_TYPE],
    ["application/cbor", CBOR_MEDIA_TYPE],
    ["application/json, application/cbor", JSON_MEDIA_TYPE],
    ["application/json;q=0.4, application/cbor;q=0.8", CBOR_MEDIA_TYPE],
    ["*/*;q=1, application/json;q=0", null],
    ["application/cbor;q=0", null],
    ["text/html", null],
    ["application/json;q=.5, application/cbor;q=2", null],
  ])("negotiates API media type for %s", (accept, expected) => {
    expect(negotiateApiMediaType(accept)).toBe(expected);
  });

  it("uses available order as the server tie preference", () => {
    expect(negotiateMediaType("application/json, application/cbor", [CBOR_MEDIA_TYPE, JSON_MEDIA_TYPE])).toBe(
      CBOR_MEDIA_TYPE,
    );
  });

  it.each([
    ["", PROBLEM_JSON_MEDIA_TYPE],
    ["application/cbor", CBOR_MEDIA_TYPE],
    ["application/cbor;q=0", PROBLEM_JSON_MEDIA_TYPE],
    ["application/json;q=0.8, application/cbor;q=0.4", PROBLEM_JSON_MEDIA_TYPE],
    ["application/problem+json;q=0, application/cbor;q=0.5", CBOR_MEDIA_TYPE],
    ["application/problem+cbor", PROBLEM_JSON_MEDIA_TYPE],
    ["text/html", PROBLEM_JSON_MEDIA_TYPE],
  ])("negotiates problem media type for %s", (accept, expected) => {
    expect(negotiateProblemMediaType(accept)).toBe(expected);
  });

  it("matches Content-Type parameters but not unowned structured suffixes", () => {
    expect(contentTypeMatches("application/cbor; profile=example", CBOR_MEDIA_TYPE)).toBe(true);
    expect(contentTypeMatches("application/vnd.example+cbor", CBOR_MEDIA_TYPE)).toBe(false);
  });
});
