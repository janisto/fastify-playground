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

  it("exposes each exact numeric lexeme before binary conversion can hide precision", () => {
    const numbers: Array<[string, number, readonly (string | number)[]]> = [];
    const value = parseStrictJson(Buffer.from("[1.0000000000000001,-1e-324]"), {
      validateNumber: (source, number, path) => numbers.push([source, number, [...path]]),
    });

    expect(value).toEqual([1, -0]);
    expect(numbers).toEqual([
      ["1.0000000000000001", 1, [0]],
      ["-1e-324", -0, [1]],
    ]);
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

  it("preserves __proto__ as an own JSON member without changing the parsed object's prototype", () => {
    const value = parse('{"__proto__":{"marketingOptIn":true}}');
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("expected object");

    expect(Object.keys(value)).toEqual(["__proto__"]);
    expect(Object.hasOwn(value, "__proto__")).toBe(true);
    expect((value as Record<string, unknown>)["marketingOptIn"]).toBeUndefined();
  });
});
