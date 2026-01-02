import fastifySwagger from "@fastify/swagger";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type, TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import fp from "fastify-plugin";
import { describe, expect, it } from "vitest";
import sensible from "../../../src/plugins/sensible.js";
import schemasRoutes from "../../../src/routes/schemas.js";

interface SchemaWithId {
  $id?: string;
}

/**
 * Wraps @fastify/swagger with a name for dependency resolution.
 */
const swaggerPlugin = fp(
  async (fastify) => {
    await fastify.register(fastifySwagger, {
      openapi: {
        openapi: "3.1.0",
        info: { title: "Test API", version: "1.0.0" },
      },
      refResolver: {
        buildLocalReference(json: SchemaWithId, _baseUri, _fragment, i) {
          return json.$id ?? `def-${i}`;
        },
      },
    });
  },
  { name: "swagger" },
);

/**
 * Helper to create a Fastify instance with swagger configured.
 * Schemas are exposed via OpenAPI's components.schemas.
 */
async function createTestApp() {
  const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();

  await fastify.register(sensible);
  await fastify.register(swaggerPlugin);

  return fastify;
}

describe("GET /schemas/:schemaName", () => {
  describe("Route Registration", () => {
    it("should register the route successfully", async () => {
      const fastify = await createTestApp();
      await fastify.register(schemasRoutes);
      await fastify.ready();
      await fastify.close();
    });
  });

  describe("Schema Retrieval", () => {
    it("should return schema JSON for valid schema name", async () => {
      const fastify = await createTestApp();

      const TestSchema = Type.Object(
        {
          id: Type.String(),
          name: Type.String(),
        },
        { $id: "TestSchema" },
      );

      fastify.addSchema(TestSchema);

      fastify.get(
        "/test-endpoint",
        {
          schema: {
            response: {
              200: { $ref: "TestSchema#" },
            },
          },
        },
        async () => ({ id: "1", name: "Test" }),
      );

      await fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/TestSchema.json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/schema+json");

      const body = response.json();
      expect(body.type).toBe("object");
      expect(body.properties.id).toBeDefined();
      expect(body.properties.name).toBeDefined();

      await fastify.close();
    });

    it("should return 404 for non-existent schema", async () => {
      const fastify = await createTestApp();
      await fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/NonExistent.json",
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    it("should return 400 for invalid schema name format", async () => {
      const fastify = await createTestApp();
      await fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/invalid-name",
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("should return 400 for schema name with special characters", async () => {
      const fastify = await createTestApp();
      await fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/invalid-name.json",
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("should return 400 for schema name starting with number", async () => {
      const fastify = await createTestApp();
      await fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/123Schema.json",
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });
  });

  describe("Content-Type Header", () => {
    it("should return application/schema+json content type", async () => {
      const fastify = await createTestApp();

      const TestSchema = Type.Object(
        {
          data: Type.String(),
        },
        { $id: "ContentTypeSchema" },
      );

      fastify.addSchema(TestSchema);

      fastify.get(
        "/content-type-test",
        {
          schema: {
            response: {
              200: { $ref: "ContentTypeSchema#" },
            },
          },
        },
        async () => ({ data: "test" }),
      );

      await fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/ContentTypeSchema.json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/schema+json");

      await fastify.close();
    });
  });

  describe("Multiple Schemas", () => {
    it("should return correct schema when multiple schemas are registered", async () => {
      const fastify = await createTestApp();

      const UserSchema = Type.Object(
        {
          userId: Type.String(),
          email: Type.String(),
        },
        { $id: "UserSchema" },
      );

      const ProductSchema = Type.Object(
        {
          productId: Type.String(),
          price: Type.Number(),
        },
        { $id: "ProductSchema" },
      );

      fastify.addSchema(UserSchema);
      fastify.addSchema(ProductSchema);

      fastify.get(
        "/users",
        {
          schema: {
            response: {
              200: { $ref: "UserSchema#" },
            },
          },
        },
        async () => ({ userId: "1", email: "test@example.com" }),
      );

      fastify.get(
        "/products",
        {
          schema: {
            response: {
              200: { $ref: "ProductSchema#" },
            },
          },
        },
        async () => ({ productId: "1", price: 100 }),
      );

      await fastify.register(schemasRoutes);
      await fastify.ready();

      const userResponse = await fastify.inject({
        method: "GET",
        url: "/schemas/UserSchema.json",
      });

      expect(userResponse.statusCode).toBe(200);
      const userBody = userResponse.json();
      expect(userBody.type).toBe("object");
      expect(userBody.properties.userId).toBeDefined();

      const productResponse = await fastify.inject({
        method: "GET",
        url: "/schemas/ProductSchema.json",
      });

      expect(productResponse.statusCode).toBe(200);
      const productBody = productResponse.json();
      expect(productBody.type).toBe("object");
      expect(productBody.properties.productId).toBeDefined();

      await fastify.close();
    });
  });

  describe("Schema Name Validation", () => {
    it("should accept schema name with numbers after first letter", async () => {
      const fastify = await createTestApp();

      const TestSchema = Type.Object(
        {
          value: Type.String(),
        },
        { $id: "Schema123" },
      );

      fastify.addSchema(TestSchema);

      fastify.get(
        "/schema123-test",
        {
          schema: {
            response: {
              200: { $ref: "Schema123#" },
            },
          },
        },
        async () => ({ value: "test" }),
      );

      await fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/Schema123.json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().type).toBe("object");

      await fastify.close();
    });

    it("should accept PascalCase schema names", async () => {
      const fastify = await createTestApp();

      const TestSchema = Type.Object(
        {
          value: Type.String(),
        },
        { $id: "MyComplexSchemaName" },
      );

      fastify.addSchema(TestSchema);

      fastify.get(
        "/complex-name-test",
        {
          schema: {
            response: {
              200: { $ref: "MyComplexSchemaName#" },
            },
          },
        },
        async () => ({ value: "test" }),
      );

      await fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/MyComplexSchemaName.json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().type).toBe("object");

      await fastify.close();
    });
  });
});
