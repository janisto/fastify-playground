import type { FastifyBaseLogger } from "fastify";
import { buildApp } from "./app.js";
import { env } from "./env.js";

export type ShutdownSignal = "SIGINT" | "SIGTERM";

interface ServerLifecycle {
  isShuttingDown: boolean;
  readonly log: Pick<FastifyBaseLogger, "error" | "info">;
  addHook(name: "onClose", hook: () => Promise<void>): unknown;
  close(): Promise<void>;
}

export async function shutdown(app: ServerLifecycle, signal: ShutdownSignal): Promise<void> {
  if (app.isShuttingDown) return;

  app.isShuttingDown = true;
  app.log.info({ signal }, "Shutdown requested");

  try {
    await app.close();
    app.log.info({ signal }, "Server closed successfully");
  } catch (error) {
    app.log.error({ err: error, signal }, "Server shutdown failed");
    process.exitCode = 1;
  }
}

export function installSignalHandlers(app: ServerLifecycle): () => void {
  const handleSigterm = () => void shutdown(app, "SIGTERM");
  const handleSigint = () => void shutdown(app, "SIGINT");
  const remove = () => {
    process.removeListener("SIGTERM", handleSigterm);
    process.removeListener("SIGINT", handleSigint);
  };

  app.addHook("onClose", async () => remove());
  process.once("SIGTERM", handleSigterm);
  process.once("SIGINT", handleSigint);

  return remove;
}

/* v8 ignore start -- executable boundary is covered by the production container smoke test -- @preserve */
async function startServer(): Promise<void> {
  const app = await buildApp();
  const removeSignalHandlers = installSignalHandlers(app);

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    removeSignalHandlers();
    app.log.fatal({ err: error }, "Server startup failed");
    process.exitCode = 1;
    await app.close().catch(() => undefined);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startServer();
}
/* v8 ignore stop -- @preserve */
