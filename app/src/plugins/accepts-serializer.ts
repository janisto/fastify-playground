import { Buffer } from "node:buffer";
import acceptsSerializer from "@fastify/accepts-serializer";
import { encode as cborEncode } from "cbor2";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const acceptsSerializerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(acceptsSerializer, {
    serializers: [
      {
        regex: /^application\/cbor$/,
        serializer: (body: unknown) => Buffer.from(cborEncode(body)) as unknown as string,
      },
      {
        regex: /^application\/problem\+cbor$/,
        serializer: (body: unknown) => Buffer.from(cborEncode(body)) as unknown as string,
      },
    ],
    default: "application/json",
  });
};

export default fp(acceptsSerializerPlugin, {
  fastify: "5.x",
  name: "@app/accepts-serializer",
});
