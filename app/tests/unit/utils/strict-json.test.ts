import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { parseStrictJson } from "../../../src/utils/strict-json.js";

const parse = (source: string) => parseStrictJson(Buffer.from(source));

describe("parseStrictJson", () => {
  it("parses the complete JSON value grammar", () => {
    expect(parse(' { "a" : [true, false, null, -1.25e+2, "x\\n", "\\uD83D\\uDE00"] } ')).toEqual({
      a: [true, false, null, -125, "x\n", "😀"],
    });
    expect(parse("{}")).toEqual({});
    expect(parse("[]")).toEqual([]);
    expect(parseStrictJson(Buffer.alloc(0))).toBeUndefined();
  });

  it.each([
    ["trailing input", "null x"],
    ["non-string key", "{1:2}"],
    ["duplicate member", '{"a":1,"a":2}'],
    ["missing object separator", '{"a" 1}'],
    ["missing object delimiter", '{"a":1 "b":2}'],
    ["missing array delimiter", "[1 2]"],
    ["unterminated string", '"abc'],
    ["unescaped control", '"a\nb"'],
    ["lone high surrogate", '"\\uD800"'],
    ["lone low surrogate", '"\\uDC00"'],
    ["invalid literal", "tru"],
    ["invalid value", "?"],
    ["non-finite number", "1e9999"],
    ["byte order mark", "\uFEFFnull"],
  ])("rejects %s", (_case, source) => {
    expect(() => parse(source)).toThrow(SyntaxError);
  });

  it("rejects invalid UTF-8 before interpreting JSON", () => {
    expect(() => parseStrictJson(Buffer.from([0xc3, 0x28]))).toThrow(TypeError);
  });
});
