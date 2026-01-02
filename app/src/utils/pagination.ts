import { Buffer } from "node:buffer";

export interface Cursor {
  type: string;
  value: string;
}

export function encodeCursor(cursor: Cursor): string {
  const data = `${cursor.type}:${cursor.value}`;
  return Buffer.from(data).toString("base64url");
}

export function decodeCursor(encoded: string | undefined): Cursor | null {
  if (!encoded) return { type: "", value: "" };
  try {
    const data = Buffer.from(encoded, "base64url").toString("utf8");
    const colonIdx = data.indexOf(":");
    if (colonIdx === -1) return null;
    return {
      type: data.slice(0, colonIdx),
      value: data.slice(colonIdx + 1),
    };
    /* v8 ignore start -- @preserve */
  } catch {
    return null;
  }
  /* v8 ignore stop -- @preserve */
}

export function buildLinkHeader(
  baseUrl: string,
  query: URLSearchParams,
  nextCursor?: string,
  prevCursor?: string,
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
  if (prevCursor) {
    const q = new URLSearchParams();
    q.set("cursor", prevCursor);
    for (const [key, value] of query) {
      if (key !== "cursor") {
        q.set(key, value);
      }
    }
    links.push(`<${baseUrl}?${q.toString()}>; rel="prev"`);
  }

  return links.join(", ");
}
