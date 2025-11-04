import fp from "fastify-plugin";

/**
 * Lifecycle hooks plugin for Fastify.
 *
 * This plugin sets up:
 * - Graceful shutdown handlers for SIGTERM and SIGINT signals
 * - onReady hook for initialization logging
 * - onListen hook for server startup logging
 * - onClose hook for cleanup operations
 *
 * Graceful shutdown ensures:
 * - All in-flight requests complete before shutdown
 * - Resources are properly cleaned up
 * - Process exits with appropriate exit code
 *
 * @see https://fastify.dev/docs/latest/Reference/Hooks/#application-lifecycle-hooks
 */
export default fp(
	async (fastify) => {
		// onReady: Triggered before server starts listening
		fastify.addHook("onReady", async () => {
			fastify.log.info("Server is ready and initialized");
		});

		// onListen: Triggered when server starts listening
		fastify.addHook("onListen", async () => {
			fastify.log.info(
				{
					address: fastify.server.address(),
					nodeVersion: process.version,
					pid: process.pid,
				},
				"Server listening",
			);
		});

		// onClose: Triggered when fastify.close() is called
		fastify.addHook("onClose", async (instance) => {
			instance.log.info("Server closing, cleaning up resources...");
			// Add cleanup logic here:
			// - Close database connections
			// - Close message queue connections
			// - Flush logs
			// - Clear caches
		});

		// Graceful shutdown handler
		/* v8 ignore next -- @preserve */
		const closeGracefully = async (signal: string) => {
			fastify.log.info(`Received ${signal}, shutting down gracefully`);

			try {
				// Close the server and trigger onClose hooks
				await fastify.close();
				fastify.log.info("Server closed successfully");
				process.exit(0);
			} catch (error) {
				fastify.log.error(error, "Error during graceful shutdown");
				process.exit(1);
			}
		};

		// Register signal handlers for graceful shutdown - Process signal handlers cannot be reliably tested
		/* v8 ignore next -- @preserve */
		process.on("SIGTERM", () => closeGracefully("SIGTERM"));
		/* v8 ignore next -- @preserve */
		process.on("SIGINT", () => closeGracefully("SIGINT"));

		// Handle uncaught exceptions
		/* v8 ignore next -- @preserve */
		process.on("uncaughtException", (error) => {
			fastify.log.fatal(error, "Uncaught exception");
			closeGracefully("uncaughtException");
		});

		// Handle unhandled promise rejections
		/* v8 ignore next -- @preserve */
		process.on("unhandledRejection", (reason, promise) => {
			fastify.log.fatal({ reason, promise }, "Unhandled promise rejection");
			closeGracefully("unhandledRejection");
		});
	},
	{
		name: "lifecycle",
		fastify: "5.x",
	},
);
