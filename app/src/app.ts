import * as path from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad, { type AutoloadPluginOptions } from "@fastify/autoload";
import Fastify, { type FastifyPluginAsync } from "fastify";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type AppOptions = {
	// Place your custom options for app below here.
} & Partial<AutoloadPluginOptions>;

// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {};

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
	// Place here your custom code!

	// Do not touch the following lines

	// This loads all plugins defined in plugins
	// those should be support plugins that are reused
	// through your application
	void fastify.register(AutoLoad, {
		dir: path.join(__dirname, "plugins"),
		options: opts,
		forceESM: true,
	});

	// This loads all plugins defined in routes
	// define your routes in one of these
	void fastify.register(AutoLoad, {
		dir: path.join(__dirname, "routes"),
		options: opts,
		forceESM: true,
	});
};

export default app;
export { app, options };

// Start server when run directly (development mode with tsx)
// In production, use fastify-cli: `fastify start -l info dist/app.js`
if (import.meta.url === `file://${process.argv[1]}`) {
	const fastify = Fastify({
		logger: {
			level: process.env.LOG_LEVEL || "info",

			// Cloud Run / Firebase App Hosting optimized configuration:
			// - Logs to stdout ✓ (Pino default)
			// - JSON format ✓ (Pino default)
			// - No file transport ✓ (Pino default)

			// Customize for Google Cloud Logging compatibility
			formatters: {
				level: (label) => {
					// Cloud Logging severity mapping
					// Maps Pino levels to Cloud Logging severity levels
					return { severity: label.toUpperCase() };
				},
			},
		},
	});

	await fastify.register(app, options);

	const port = Number(process.env.PORT || 3000);
	const host = process.env.HOST || "0.0.0.0";

	try {
		await fastify.listen({ port, host });
	} catch (error) {
		fastify.log.error(error);
		process.exit(1);
	}
}
