import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

describe("server executable startup", () => {
  const blockers: ReturnType<typeof createServer>[] = [];

  afterEach(async () => {
    await Promise.all(
      blockers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
  });

  it("logs a controlled failure and exits non-zero when the listen address is occupied", async () => {
    const blocker = createServer();
    blockers.push(blocker);
    await new Promise<void>((resolve, reject) => {
      blocker.listen(0, "127.0.0.1", resolve);
      blocker.once("error", reject);
    });
    const address = blocker.address();
    if (typeof address !== "object" || address === null) throw new Error("expected a TCP listener");

    const child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        LOG_LEVEL: "info",
        NODE_ENV: "test",
        PORT: String(address.port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
    });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("server process did not exit after listen failure"));
      }, 5_000);
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });

    expect(exitCode).toBe(1);
    expect(output).toContain("Server startup failed");
    expect(output).not.toContain("UnhandledPromiseRejection");
  });
});
