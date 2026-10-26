import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import type { FastifyPluginAsync } from "fastify";
import { CATALOG_MEDIA_TYPE, TEXT_MEDIA_TYPE } from "../utils/content-negotiation.js";
import { API_CATALOG_LINK, addLinkHeader, LLMS_INDEX_LINK } from "../utils/link-header.js";

const documentation: FastifyPluginAsync = async (fastify) => {
  const index = readFileSync(new URL("../../../llms.txt", import.meta.url));
  const guide = readFileSync(new URL("../../../llms-full.txt", import.meta.url));
  const catalog = Buffer.from(
    JSON.stringify({
      linkset: [
        {
          anchor: "/",
          "service-desc": [{ href: "/openapi.json", type: "application/json" }],
          "service-doc": [
            { href: "/llms.txt", type: "text/plain" },
            { href: "/llms-full.txt", type: "text/plain" },
          ],
          status: [{ href: "/health", type: "application/json" }],
        },
      ],
    }),
  );

  fastify.route({
    method: ["GET", "HEAD"],
    url: "/.well-known/api-catalog",
    schema: { hide: true, produces: [CATALOG_MEDIA_TYPE] },
    handler: async (request, reply) => {
      addLinkHeader(reply, API_CATALOG_LINK);
      addLinkHeader(reply, LLMS_INDEX_LINK);
      return reply
        .type(CATALOG_MEDIA_TYPE)
        .header("Content-Length", catalog.byteLength)
        .send(request.method === "HEAD" ? undefined : catalog);
    },
  });
  fastify.get(
    "/llms.txt",
    {
      schema: { hide: true, produces: [TEXT_MEDIA_TYPE] },
    },
    async (_request, reply) => reply.type(TEXT_MEDIA_TYPE).send(index),
  );
  fastify.get(
    "/llms-full.txt",
    {
      schema: { hide: true, produces: [TEXT_MEDIA_TYPE] },
    },
    async (_request, reply) => {
      addLinkHeader(reply, LLMS_INDEX_LINK);
      return reply.type(TEXT_MEDIA_TYPE).send(guide);
    },
  );
};

export default documentation;
