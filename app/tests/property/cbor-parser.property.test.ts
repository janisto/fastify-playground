import { Buffer } from "node:buffer";
import { fc, test } from "@fast-check/vitest";
import { encode } from "cbor2";
import Fastify from "fastify";
import { expect } from "vitest";
import cborParser from "../../src/plugins/cbor-parser.js";
import { propertyParameters } from "./config.js";

test.prop([fc.jsonValue({ maxDepth: 4 })], propertyParameters)(
  "round-trips bounded JSON values through the CBOR request parser",
  async (value) => {
    const app = Fastify({ logger: false });
    let received: unknown;
    app.register(cborParser);
    app.post("/property", async (request, reply) => {
      received = request.body;
      return reply.code(204).send();
    });

    try {
      const response = await app.inject({
        headers: { "content-type": "application/cbor" },
        method: "POST",
        payload: Buffer.from(encode(value)),
        url: "/property",
      });

      expect(response.statusCode).toBe(204);
      expect(received).toEqual(value);
    } finally {
      await app.close();
    }
  },
);

test.prop([fc.uint8Array({ maxLength: 128 })], propertyParameters)(
  "never invokes the handler after a controlled CBOR parse failure",
  async (bytes) => {
    const app = Fastify({ logger: false });
    let handlerCalls = 0;
    app.register(cborParser);
    app.post("/property", async (_request, reply) => {
      handlerCalls += 1;
      return reply.code(204).send();
    });

    try {
      const response = await app.inject({
        headers: { "content-type": "application/cbor" },
        method: "POST",
        payload: Buffer.from(bytes),
        url: "/property",
      });

      expect([204, 400]).toContain(response.statusCode);
      expect(handlerCalls).toBe(response.statusCode === 204 ? 1 : 0);
    } finally {
      await app.close();
    }
  },
);
