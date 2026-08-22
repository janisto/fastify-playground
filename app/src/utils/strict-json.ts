import { TextDecoder } from "node:util";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const NUMBER_PATTERN = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;

export interface StrictJsonOptions {
  readonly validateNumber?: (source: string, value: number, path: readonly (string | number)[]) => void;
}

function assertValidSurrogates(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new SyntaxError("lone high surrogate");
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new SyntaxError("lone low surrogate");
    }
  }
}

class JsonParser {
  private offset = 0;
  private readonly path: Array<string | number> = [];
  private readonly source: string;
  private readonly validateNumber: StrictJsonOptions["validateNumber"];

  constructor(source: string, options: StrictJsonOptions) {
    this.source = source;
    this.validateNumber = options.validateNumber;
  }

  parse(): unknown {
    this.skipWhitespace();
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.offset !== this.source.length) throw new SyntaxError("trailing JSON content");
    return value;
  }

  private current(): string | undefined {
    return this.source.at(this.offset);
  }

  private skipWhitespace(): void {
    while ([" ", "\t", "\n", "\r"].includes(this.current() ?? "")) this.offset += 1;
  }

  private parseValue(): unknown {
    const character = this.current();
    if (character === "{") return this.parseObject();
    if (character === "[") return this.parseArray();
    if (character === '"') return this.parseString();
    if (character === "t") return this.parseLiteral("true", true);
    if (character === "f") return this.parseLiteral("false", false);
    if (character === "n") return this.parseLiteral("null", null);
    return this.parseNumber();
  }

  private parseObject(): Record<string, unknown> {
    this.offset += 1;
    this.skipWhitespace();
    const result: Record<string, unknown> = {};
    const keys = new Set<string>();
    if (this.current() === "}") {
      this.offset += 1;
      return result;
    }

    while (true) {
      if (this.current() !== '"') throw new SyntaxError("object key must be a string");
      const key = this.parseString();
      if (keys.has(key)) throw new SyntaxError("duplicate JSON object name");
      keys.add(key);
      this.skipWhitespace();
      if (this.current() !== ":") throw new SyntaxError("missing object separator");
      this.offset += 1;
      this.skipWhitespace();
      this.path.push(key);
      const value = this.parseValue();
      this.path.pop();
      Object.defineProperty(result, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      this.skipWhitespace();
      const delimiter = this.current();
      if (delimiter === "}") {
        this.offset += 1;
        return result;
      }
      if (delimiter !== ",") throw new SyntaxError("missing object delimiter");
      this.offset += 1;
      this.skipWhitespace();
    }
  }

  private parseArray(): unknown[] {
    this.offset += 1;
    this.skipWhitespace();
    const result: unknown[] = [];
    if (this.current() === "]") {
      this.offset += 1;
      return result;
    }

    while (true) {
      this.path.push(result.length);
      result.push(this.parseValue());
      this.path.pop();
      this.skipWhitespace();
      const delimiter = this.current();
      if (delimiter === "]") {
        this.offset += 1;
        return result;
      }
      if (delimiter !== ",") throw new SyntaxError("missing array delimiter");
      this.offset += 1;
      this.skipWhitespace();
    }
  }

  private parseString(): string {
    const start = this.offset;
    this.offset += 1;
    let escaped = false;
    while (this.offset < this.source.length) {
      const character = this.current();
      if (character === undefined) break;
      if (!escaped && character === '"') {
        this.offset += 1;
        const value = JSON.parse(this.source.slice(start, this.offset)) as string;
        assertValidSurrogates(value);
        return value;
      }
      if (!escaped && character.charCodeAt(0) <= 0x1f) throw new SyntaxError("unescaped control character");
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      }
      this.offset += 1;
    }
    throw new SyntaxError("unterminated string");
  }

  private parseLiteral<T>(literal: string, value: T): T {
    if (this.source.slice(this.offset, this.offset + literal.length) !== literal) {
      throw new SyntaxError("invalid JSON literal");
    }
    this.offset += literal.length;
    return value;
  }

  private parseNumber(): number {
    NUMBER_PATTERN.lastIndex = this.offset;
    const match = NUMBER_PATTERN.exec(this.source);
    if (!match) throw new SyntaxError("invalid JSON value");
    this.offset = NUMBER_PATTERN.lastIndex;
    const source = match[0];
    const value = Number(source);
    if (!Number.isFinite(value)) throw new SyntaxError("non-finite JSON number");
    this.validateNumber?.(source, value, this.path);
    return value;
  }
}

export function parseStrictJson(bytes: Buffer, options: StrictJsonOptions = {}): unknown {
  if (bytes.length === 0) return undefined;
  const source = UTF8_DECODER.decode(bytes);
  if (source.startsWith("\uFEFF")) throw new SyntaxError("JSON byte-order mark is not supported");
  return new JsonParser(source, options).parse();
}
