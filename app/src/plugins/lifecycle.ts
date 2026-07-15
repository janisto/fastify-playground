import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    isShuttingDown: boolean;
  }
}

/** Tracks application lifecycle state and emits application-owned lifecycle records. */
export default fp(
  async (fastify) => {
    fastify.decorate("isShuttingDown", false);

    fastify.addHook("onReady", async () => {
      fastify.log.info("Server is ready and initialized");
    });

    /* v8 ignore start -- requires a real listening socket; covered by container smoke tests -- @preserve */
    fastify.addHook("onListen", async () => {
      fastify.log.info(
        {
          address: fastify.server.address(),
          node_version: process.version,
          pid: process.pid,
        },
        "Server listening",
      );
    });
    /* v8 ignore stop -- @preserve */

    fastify.addHook("onClose", async (instance) => {
      instance.log.info("Server closing, cleaning up resources");
    });
  },
  {
    name: "lifecycle",
    fastify: "5.x",
  },
);
