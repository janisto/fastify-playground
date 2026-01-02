import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type, TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import sensible from "../../../src/plugins/sensible.js";
import schemasRoutes from "../../../src/routes/schemas.js";

describe("GET /schemas/:schemaName", () => {
  describe("Route Registration", () => {
    it("should register the route successfully", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(sensible);
      await fastify.register(schemasRoutes);
      await fastify.ready();
      await fastify.close();
    });
  });

  describe("Schema Retrieval", () => {
    it("should return schema JSON for valid schema name", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(sensible);

      const TestSchema = Type.Object(
        {
          id: Type.String(),
          name: Type.String(),
        },
        { $id: "TestSchema" },
      );

      fastify.addSchema(TestSchema);
      await fastify.register(schemasRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/TestSchema.json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/schema+json");

      const body = response.json();
      expect(body.$id).toBe("TestSchema");
      expect(body.type).toBe("object");
      expect(body.properties.id).toBeDefined();
      expect(body.properties.name).toBeDefined();

      await fastify.close();
    });

    it("should return 404 for non-existent schema", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(sensible);
      await fastify.register(schemasRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/NonExistent.json",
      });

      expect(response.statusCode).toBe(404);

      await fastify.close();
    });

    it("should return 400 for invalid schema name format", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(sensible);
      await fastify.register(schemasRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/invalid-name",
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("should return 400 for schema name with special characters", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(sensible);
      await fastify.register(schemasRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/invalid-name.json",
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("should return 400 for schema name starting with number", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(sensible);
      await fastify.register(schemasRoutes);

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
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(sensible);

      const TestSchema = Type.Object(
        {
          data: Type.String(),
        },
        { $id: "ContentTypeSchema" },
      );

      fastify.addSchema(TestSchema);
      await fastify.register(schemasRoutes);

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
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(sensible);

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
      await fastify.register(schemasRoutes);

      const userResponse = await fastify.inject({
        method: "GET",
        url: "/schemas/UserSchema.json",
      });

      expect(userResponse.statusCode).toBe(200);
      const userBody = userResponse.json();
      expect(userBody.$id).toBe("UserSchema");
      expect(userBody.properties.userId).toBeDefined();

      const productResponse = await fastify.inject({
        method: "GET",
        url: "/schemas/ProductSchema.json",
      });

      expect(productResponse.statusCode).toBe(200);
      const productBody = productResponse.json();
      expect(productBody.$id).toBe("ProductSchema");
      expect(productBody.properties.productId).toBeDefined();

      await fastify.close();
    });
  });

  describe("Schema Name Validation", () => {
    it("should accept schema name with numbers after first letter", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(sensible);

      const TestSchema = Type.Object(
        {
          value: Type.String(),
        },
        { $id: "Schema123" },
      );

      fastify.addSchema(TestSchema);
      await fastify.register(schemasRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/Schema123.json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().$id).toBe("Schema123");

      await fastify.close();
    });

    it("should accept PascalCase schema names", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(sensible);

      const TestSchema = Type.Object(
        {
          value: Type.String(),
        },
        { $id: "MyComplexSchemaName" },
      );

      fastify.addSchema(TestSchema);
      await fastify.register(schemasRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/schemas/MyComplexSchemaName.json",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().$id).toBe("MyComplexSchemaName");

      await fastify.close();
    });
  });
});
