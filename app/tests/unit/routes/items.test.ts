import sensible from "@fastify/sensible";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import fp from "fastify-plugin";
import { describe, expect, it } from "vitest";
import itemsRoutes from "../../../src/routes/items.js";
import { encodeCursor } from "../../../src/utils/pagination.js";

describe("Items Routes", () => {
  describe("GET /items", () => {
    it("should return a paginated list of items", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/items",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");

      const body = response.json();
      expect(body.items).toBeDefined();
      expect(body.items).toHaveLength(20);
      expect(body.total).toBe(30);

      await fastify.close();
    });

    it("should return items with correct structure", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/items?limit=1",
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.items).toHaveLength(1);
      const item = body.items[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("category");
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("inStock");
      expect(item).toHaveProperty("createdAt");
      expect(item).toHaveProperty("description");

      await fastify.close();
    });

    it("should paginate with cursor", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const firstResponse = await fastify.inject({
        method: "GET",
        url: "/items?limit=5",
      });

      expect(firstResponse.statusCode).toBe(200);
      const firstBody = firstResponse.json();
      expect(firstBody.items).toHaveLength(5);
      expect(firstBody.items[0].id).toBe("item-001");
      expect(firstBody.items[4].id).toBe("item-005");

      const cursor = encodeCursor({ type: "item", value: "item-005" });
      const secondResponse = await fastify.inject({
        method: "GET",
        url: `/items?limit=5&cursor=${cursor}`,
      });

      expect(secondResponse.statusCode).toBe(200);
      const secondBody = secondResponse.json();
      expect(secondBody.items).toHaveLength(5);
      expect(secondBody.items[0].id).toBe("item-006");
      expect(secondBody.items[4].id).toBe("item-010");

      await fastify.close();
    });

    it("should filter by category", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/items?category=electronics",
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.total).toBe(13);
      for (const item of body.items) {
        expect(item.category).toBe("electronics");
      }

      await fastify.close();
    });

    it("should return 400 for invalid cursor format", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/items?cursor=invalid!!!",
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.message).toContain("invalid cursor format");

      await fastify.close();
    });

    it("should return 400 for cursor type mismatch", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const cursor = encodeCursor({ type: "wrong", value: "item-001" });
      const response = await fastify.inject({
        method: "GET",
        url: `/items?cursor=${cursor}`,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.message).toContain("cursor type mismatch");

      await fastify.close();
    });

    it("should return 400 for cursor referencing unknown item", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const cursor = encodeCursor({ type: "item", value: "item-999" });
      const response = await fastify.inject({
        method: "GET",
        url: `/items?cursor=${cursor}`,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.message).toContain("cursor references unknown item");

      await fastify.close();
    });

    it("should include Link header with next cursor when more items available", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/items?limit=5",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.link).toBeDefined();
      expect(response.headers.link).toContain('rel="next"');

      await fastify.close();
    });

    it("should include Link header with prev cursor when not at start", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const cursor = encodeCursor({ type: "item", value: "item-010" });
      const response = await fastify.inject({
        method: "GET",
        url: `/items?limit=5&cursor=${cursor}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.link).toBeDefined();
      expect(response.headers.link).toContain('rel="next"');
      expect(response.headers.link).toContain('rel="prev"');

      await fastify.close();
    });

    it("should not include Link header on last page", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const cursor = encodeCursor({ type: "item", value: "item-025" });
      const response = await fastify.inject({
        method: "GET",
        url: `/items?limit=10&cursor=${cursor}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items).toHaveLength(5);
      expect(response.headers.link).toContain('rel="prev"');

      await fastify.close();
    });

    it("should respect limit parameter", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/items?limit=10",
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.items).toHaveLength(10);

      await fastify.close();
    });

    it("should return 400 for limit less than 1", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/items?limit=0",
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("should return 400 for limit greater than 100", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/items?limit=101",
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("should return 400 for invalid category", async () => {
      const fastify = Fastify();
      await fastify.register(sensible);
      await fastify.register(itemsRoutes);

      const response = await fastify.inject({
        method: "GET",
        url: "/items?category=invalid",
      });

      expect(response.statusCode).toBe(400);

      await fastify.close();
    });

    it("should register ItemsData schema for discovery", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      const { default: schemaRegistry } = await import("../../../src/plugins/schema-registry.js");
      await fastify.register(sensible);
      await fastify.register(schemaRegistry);
      await fastify.register(fp(itemsRoutes));
      await fastify.ready();

      const schemas = fastify.getSchemas();
      expect(schemas.ItemsResponse).toBeDefined();
      const itemsResponseSchema = schemas.ItemsResponse as { $id?: string };
      expect(itemsResponseSchema.$id).toBe("ItemsResponse");

      await fastify.close();
    });
  });
});
