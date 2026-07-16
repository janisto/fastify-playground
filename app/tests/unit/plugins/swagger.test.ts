import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import swagger from "../../../src/plugins/swagger.js";
import health from "../../../src/routes/health.js";

describe("OpenAPI documentation", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function build() {
    const app = Fastify();
    apps.push(app);
    app.register(swagger);
    app.register(health);
    return app;
  }

  it("publishes the application contract as OpenAPI 3.1 JSON", async () => {
    const response = await build().inject({ method: "GET", url: "/api-docs/json" });
    const document = response.json();

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(document).toMatchObject({
      openapi: "3.1.0",
      info: { title: "Fastify Playground API", version: "1.0.0" },
      servers: [{ url: "/", description: "Current server" }],
      paths: {
        "/health": {
          get: {
            operationId: "getHealth",
            summary: "Liveness check",
            tags: ["Health"],
          },
        },
      },
    });
    expect(document.paths["/health"].get.responses["200"].content["application/json"].schema).toMatchObject({
      type: "object",
      required: ["status"],
      properties: { status: { enum: ["healthy"], type: "string" } },
    });
  });

  it("publishes the same contract as YAML", async () => {
    const response = await build().inject({ method: "GET", url: "/api-docs/yaml" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/x-yaml");
    expect(response.payload).toContain("openapi: 3.1.0");
    expect(response.payload).toContain("operationId: getHealth");
  });

  it("serves the interactive documentation and its static policy", async () => {
    const app = build();
    const ui = await app.inject({ method: "GET", url: "/api-docs" });
    const stylesheet = await app.inject({ method: "GET", url: "/api-docs/static/swagger-ui.css" });

    expect(ui.statusCode).toBe(200);
    expect(ui.headers["content-type"]).toContain("text/html");
    expect(ui.payload).toContain("Swagger UI");
    expect(stylesheet.statusCode).toBe(200);
    expect(stylesheet.headers["content-type"]).toContain("text/css");
    expect(stylesheet.headers["content-security-policy"]).toEqual(expect.any(String));
  });

  it("keeps explicit schema identifiers stable in generated components", async () => {
    const app = build();
    app.addSchema({
      $id: "TestRefSchema",
      type: "object",
      properties: { id: { type: "string" } },
    });
    app.get("/test-ref", { schema: { response: { 200: { $ref: "TestRefSchema#" } } } }, async () => ({ id: "123" }));

    const response = await app.inject({ method: "GET", url: "/api-docs/json" });

    expect(response.json().components.schemas.TestRefSchema).toMatchObject({
      type: "object",
      properties: { id: { type: "string" } },
    });
  });
});
