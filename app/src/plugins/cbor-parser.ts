import { decode } from "cbor2";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

const CBOR_DECODE_ERROR = "FST_CBOR_DECODE_ERROR";

async function parseCbor(_request: FastifyRequest, payload: Buffer): Promise<unknown> {
  if (payload.length === 0) {
    return undefined;
  }
  try {
    return decode(new Uint8Array(payload));
  } catch (err) {
    const error = new Error("Invalid CBOR: Unable to decode request body") as Error & {
      statusCode: number;
      code: string;
      cause: unknown;
    };
    error.statusCode = 400;
    error.code = CBOR_DECODE_ERROR;
    error.cause = err;
    throw error;
  }
}

const cborParserPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addContentTypeParser("application/cbor", { parseAs: "buffer", bodyLimit: 1048576 }, parseCbor);
  fastify.addContentTypeParser(/^application\/.+\+cbor$/, { parseAs: "buffer", bodyLimit: 1048576 }, parseCbor);
};

export default fp(cborParserPlugin, {
  fastify: "5.x",
  name: "@app/cbor-parser",
});
