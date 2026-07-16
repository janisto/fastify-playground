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
    fastify.register(fastifySwagger, {
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

  fastify.register(sensible);
  fastify.register(swaggerPlugin);

  return fastify;
}

describe("GET /schemas/:schemaName", () => {
  describe("Schema Retrieval", () => {
    it("returns schema JSON for valid schema name", async () => {
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

      fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/TestSchema.json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/schema+json");

      const body = response.json();
      expect(body.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(body.type).toBe("object");
      expect(body.properties).toMatchObject({ id: { type: "string" }, name: { type: "string" } });

      await fastify.close();
    });

    it("rewrite component references into standalone definitions", async () => {
      const fastify = await createTestApp();
      const ChildSchema = Type.Object({ id: Type.String() }, { $id: "ChildSchema" });
      const ParentSchema = Type.Object({ child: Type.Ref("ChildSchema") }, { $id: "ParentSchema" });
      fastify.addSchema(ChildSchema);
      fastify.addSchema(ParentSchema);
      fastify.get("/parent", { schema: { response: { 200: { $ref: "ParentSchema#" } } } }, async () => ({
        child: { id: "child-1" },
      }));
      fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({ method: "GET", url: "/schemas/ParentSchema.json" });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body.properties.child.$ref).toBe("#/$defs/ChildSchema");
      expect(body.$defs.ChildSchema.properties.id.type).toBe("string");
      expect(JSON.stringify(body)).not.toContain("#/components/schemas/");
      await fastify.close();
    });

    it("returns 404 for non-existent schema", async () => {
      const fastify = await createTestApp();
      fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/NonExistent.json",
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    it("returns 400 for invalid schema name format", async () => {
      const fastify = await createTestApp();
      fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/invalid-name",
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("returns 400 for schema name with special characters", async () => {
      const fastify = await createTestApp();
      fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/invalid-name.json",
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("returns 400 for schema name starting with number", async () => {
      const fastify = await createTestApp();
      fastify.register(schemasRoutes);
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
    it("returns application/schema+json content type", async () => {
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

      fastify.register(schemasRoutes);
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
    it("returns correct schema when multiple schemas are registered", async () => {
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

      fastify.register(schemasRoutes);
      await fastify.ready();

      const userResponse = await fastify.inject({
        method: "GET",
        url: "/schemas/UserSchema.json",
      });

      expect(userResponse.statusCode).toBe(200);
      const userBody = userResponse.json();
      expect(userBody.type).toBe("object");
      expect(userBody.properties.userId).toMatchObject({ type: "string" });

      const productResponse = await fastify.inject({
        method: "GET",
        url: "/schemas/ProductSchema.json",
      });

      expect(productResponse.statusCode).toBe(200);
      const productBody = productResponse.json();
      expect(productBody.type).toBe("object");
      expect(productBody.properties.productId).toMatchObject({ type: "string" });

      await fastify.close();
    });
  });

  describe("Schema Name Validation", () => {
    it("accepts schema name with numbers after first letter", async () => {
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

      fastify.register(schemasRoutes);
      await fastify.ready();

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/Schema123.json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().type).toBe("object");

      await fastify.close();
    });

    it("accepts PascalCase schema names", async () => {
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

      fastify.register(schemasRoutes);
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

  describe("Empty Schemas Handling", () => {
    it("handles missing components.schemas gracefully", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();

      // Register minimal swagger without any schemas
      const minimalSwagger = fp(
        async (f) => {
          await f.register(fastifySwagger, {
            openapi: {
              openapi: "3.1.0",
              info: { title: "Empty API", version: "1.0.0" },
            },
          });
        },
        { name: "swagger" },
      );

      fastify.register(sensible);
      fastify.register(minimalSwagger);
      fastify.register(schemasRoutes);
      await fastify.ready();

      // Request a non-existent schema when components.schemas is empty/undefined
      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/NonExistent.json",
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    it("handles undefined components object from swagger", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();

      // Create a mock swagger that returns an OpenAPI doc without components
      const mockSwagger = fp(
        async (f) => {
          // Mock the swagger function to return a minimal document without components
          f.decorate("swagger", () => ({
            openapi: "3.1.0",
            info: { title: "No Components API", version: "1.0.0" },
            paths: {},
          }));
        },
        { name: "swagger" },
      );

      fastify.register(sensible);
      fastify.register(mockSwagger);
      fastify.register(schemasRoutes);
      await fastify.ready();

      // No OpenAPI component schemas are available.
      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/AnySchema.json",
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });
  });
});
