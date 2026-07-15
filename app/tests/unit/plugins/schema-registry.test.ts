import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import schemaRegistry from "../../../src/plugins/schema-registry.js";

describe("schema registry", () => {
  it("registers the application Problem Details contract without response-only metadata", async () => {
    const app = Fastify();
    app.register(schemaRegistry);
    await app.ready();

    expect(app.getSchema("ErrorModel")).toMatchObject({
      $id: "ErrorModel",
      type: "object",
      required: ["title", "status"],
      properties: {
        status: { type: "integer" },
        title: { type: "string" },
      },
    });
    expect(JSON.stringify(app.getSchema("ErrorModel"))).not.toContain('"$schema"');
    await app.close();
  });
});
