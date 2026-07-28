import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GitHubClient } from "../../../../src/modules/github/client.js";

describe("GitHubClient response deadline", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server?.listening) return;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("times out when an upstream sends headers and then stalls its body", async () => {
    const sentHeaders = vi.fn();
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"login":');
      sentHeaders();
    });
    await new Promise<void>((resolve, reject) => {
      server?.listen(0, "127.0.0.1", () => resolve());
      server?.once("error", reject);
    });
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("expected a TCP listener");

    const client = new GitHubClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      timeoutMs: 50,
    });

    await expect(client.getOwner("octocat")).rejects.toMatchObject({
      message: "GitHub API request timed out",
      code: "github_timeout",
      statusCode: 504,
    });
    expect(sentHeaders).toHaveBeenCalledOnce();
  });
});
