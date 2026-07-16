import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";

export const MAX_CURSOR_LENGTH = 2048;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

export interface Cursor {
  type: string;
  value: string;
}

export class InvalidCursorError extends Error {
  public override readonly name = "InvalidCursorError";
}

export function encodeCursor(cursor: Cursor): string {
  const data = `${cursor.type}:${cursor.value}`;
  return Buffer.from(data).toString("base64url");
}

export function decodeCursor(encoded: string | undefined): Cursor | null {
  if (encoded === undefined) return { type: "", value: "" };
  if (
    encoded.length === 0 ||
    encoded.length > MAX_CURSOR_LENGTH ||
    encoded.length % 4 === 1 ||
    !BASE64URL_PATTERN.test(encoded)
  ) {
    return null;
  }

  try {
    const bytes = Buffer.from(encoded, "base64url");
    if (bytes.toString("base64url") !== encoded) return null;

    const data = UTF8_DECODER.decode(bytes);
    const colonIdx = data.indexOf(":");
    if (colonIdx <= 0 || colonIdx === data.length - 1) return null;
    return {
      type: data.slice(0, colonIdx),
      value: data.slice(colonIdx + 1),
    };
  } catch {
    return null;
  }
}

export function buildLinkHeader(
  baseUrl: string,
  query: URLSearchParams,
  nextCursor?: string,
  prevCursor?: string | null,
): string {
  const links: string[] = [];

  if (nextCursor) {
    const q = new URLSearchParams();
    q.set("cursor", nextCursor);
    for (const [key, value] of query) {
      if (key !== "cursor") {
        q.set(key, value);
      }
    }
    links.push(`<${baseUrl}?${q.toString()}>; rel="next"`);
  }
  if (prevCursor !== undefined) {
    const q = new URLSearchParams();
    if (prevCursor !== null) q.set("cursor", prevCursor);
    for (const [key, value] of query) {
      if (key !== "cursor") {
        q.set(key, value);
      }
    }
    links.push(`<${baseUrl}?${q.toString()}>; rel="prev"`);
  }

  return links.join(", ");
}
