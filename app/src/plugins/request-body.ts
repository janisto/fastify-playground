import { decode as cborDecode } from "cbor2";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { parseStrictJson } from "../utils/strict-json.js";

export const MAX_REQUEST_BODY_BYTES = 1_000_000;

function parsingError(message: string, cause: unknown): Error & { statusCode: number; code: string; cause: unknown } {
  return Object.assign(new Error(message), { statusCode: 400, code: "FST_PORTABLE_PARSE_ERROR", cause });
}

async function parseJson(_request: FastifyRequest, payload: Buffer): Promise<unknown> {
  try {
    return parseStrictJson(payload);
  } catch (error) {
    throw parsingError("Invalid JSON request body", error);
  }
}

async function parseCbor(_request: FastifyRequest, payload: Buffer): Promise<unknown> {
  if (payload.length === 0) return undefined;
  try {
    return cborDecode(new Uint8Array(payload), { rejectDuplicateKeys: true });
  } catch (error) {
    throw parsingError("Invalid CBOR request body", error);
  }
}

const requestBodyPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.removeContentTypeParser("application/json");
  fastify.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: MAX_REQUEST_BODY_BYTES }, parseJson);
  fastify.addContentTypeParser("application/cbor", { parseAs: "buffer", bodyLimit: MAX_REQUEST_BODY_BYTES }, parseCbor);
};

export default fp(requestBodyPlugin, {
  fastify: "5.x",
  name: "@app/request-body",
});
