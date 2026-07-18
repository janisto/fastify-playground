import { fc, test } from "@fast-check/vitest";
import { expect } from "vitest";
import { parseCorsOrigins } from "../../src/env.js";
import { propertyParameters } from "./config.js";

const hostname = fc
  .array(fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/), { minLength: 1, maxLength: 3 })
  .map((labels) => `${labels.join(".")}.example`);
const origin = fc
  .record({
    hostname,
    port: fc.constantFrom("", ":80", ":443", ":3000", ":65535"),
    scheme: fc.constantFrom("http", "https"),
    trailingSlash: fc.boolean(),
  })
  .map(({ hostname: host, port, scheme, trailingSlash }) => `${scheme}://${host}${port}${trailingSlash ? "/" : ""}`);

test.prop([fc.array(origin, { minLength: 1, maxLength: 12 }), fc.boolean()], propertyParameters)(
  "normalizes exact HTTP origins while preserving first-seen order",
  (origins, asJson) => {
    const duplicated = origins.flatMap((value, index) => (index % 2 === 0 ? [value, value] : [value]));
    const raw = asJson ? JSON.stringify(duplicated) : duplicated.join(", ");
    const expected = [...new Set(duplicated.map((value) => new URL(value).origin))];

    expect(parseCorsOrigins(raw)).toEqual(expected);
  },
);

const invalidCorsValue = fc.oneof(
  hostname.map((host) => `https://${host}/path`),
  fc.tuple(hostname, fc.constantFrom("/.", "/segment/..")).map(([host, path]) => `https://${host}${path}`),
  hostname.map((host) => `https://${host}?tenant=1`),
  hostname.map((host) => `https://${host}#fragment`),
  hostname.map((host) => `https://user:pass@${host}`),
  hostname.map((host) => `ftp://${host}`),
  fc.constant("*"),
  fc.constant('["https://app.example", 42]'),
);

test.prop([invalidCorsValue], propertyParameters)(
  "rejects origins that cross the exact-origin security boundary",
  (raw) => {
    expect(() => parseCorsOrigins(raw)).toThrow();
  },
);
