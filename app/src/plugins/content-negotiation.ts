import { Buffer } from "node:buffer";
import { encode as cborEncode } from "cbor2";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { CBOR_MEDIA_TYPE, negotiateMediaType } from "../utils/content-negotiation.js";

declare module "fastify" {
  interface FastifyRequest {
    responseMediaType: string | null;
  }
}

function getAcceptHeader(request: FastifyRequest): string {
  return request.raw.headersDistinct?.["accept"]?.join(",") ?? request.headers.accept ?? "";
}

function hasSuccessRepresentation(request: FastifyRequest): boolean {
  const responseSchemas = request.routeOptions.schema?.response;
  if (!responseSchemas || typeof responseSchemas !== "object") return true;

  const statuses = Object.keys(responseSchemas);
  if (statuses.length === 0) return true;
  return statuses.some((status) => {
    if (["default", "2xx", "3xx"].includes(status.toLowerCase())) return true;
    const statusCode = Number(status);
    return statusCode >= 200 && statusCode < 400 && statusCode !== 204 && statusCode !== 205;
  });
}

const contentNegotiationPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("responseMediaType", null);

  fastify.addHook("onRequest", async (request) => {
    const available = request.routeOptions.schema?.produces;
    if (!available?.length || !hasSuccessRepresentation(request)) return;

    const selected = negotiateMediaType(getAcceptHeader(request), available, new Set([CBOR_MEDIA_TYPE]));
    if (!selected) {
      throw fastify.httpErrors.notAcceptable("No acceptable response representation is available");
    }
    request.responseMediaType = selected;
  });

  fastify.addHook("onSend", async (request, reply, payload) => {
    if (reply.statusCode >= 400 || request.responseMediaType === null || payload === null) return payload;
    if (request.responseMediaType !== CBOR_MEDIA_TYPE) {
      reply.header("Content-Type", request.responseMediaType);
      return payload;
    }
    if (typeof payload !== "string" || payload.length === 0) return payload;

    reply.type(CBOR_MEDIA_TYPE);
    return Buffer.from(cborEncode(JSON.parse(payload)));
  });
};

export default fp(contentNegotiationPlugin, {
  fastify: "5.x",
  name: "@app/content-negotiation",
  dependencies: ["sensible"],
});
