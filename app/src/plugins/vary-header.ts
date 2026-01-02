import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const varyHeaderPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async (_request, reply) => {
    reply.header("Vary", ["Accept", "Origin"]);
  });
};

export default fp(varyHeaderPlugin, {
  fastify: "5.x",
  name: "@app/vary-header",
});
