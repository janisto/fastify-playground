import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { itemsRoutes } from "../../../../src/modules/items/index.js";
import * as itemsService from "../../../../src/modules/items/service.js";
import errorHandler from "../../../../src/plugins/error-handler.js";
import sensible from "../../../../src/plugins/sensible.js";
import { encodeCursor } from "../../../../src/utils/pagination.js";

describe("items routes", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler);
    await fastify.register(sensible);
    await fastify.register(errorHandler);
    await fastify.register(itemsRoutes);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe("GET /", () => {
    it("returns paginated list with default limit", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");

      const body = response.json();
      expect(body.items).toBeDefined();
      expect(body.items).toHaveLength(20);
      expect(body.total).toBe(30);
    });

    it("returns items with custom limit", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/?limit=5",
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.items).toHaveLength(5);
    });

    it("filters items by category", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/?category=electronics",
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      for (const item of body.items) {
        expect(item.category).toBe("electronics");
      }
    });

    it("paginates with cursor", async () => {
      const cursor = encodeCursor({ type: "item", value: "item-005" });
      const response = await fastify.inject({
        method: "GET",
        url: `/?cursor=${cursor}`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.items[0].id).toBe("item-006");
    });

    it("includes Link header when pagination available", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/?limit=5",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.link).toBeDefined();
      expect(response.headers.link).toContain('rel="next"');
    });

    it("rejects invalid cursor with 400 error", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/?cursor=invalid-cursor",
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.status).toBe(400);
      expect(body.detail).toContain("invalid cursor format");
    });

    it("rejects limit exceeding maximum with 422 error", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/?limit=101",
      });

      expect(response.statusCode).toBe(422);
      const body = response.json();
      expect(body.status).toBe(422);
      expect(body.detail).toBe("validation failed");
    });

    it("rejects limit less than minimum with 422 error", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/?limit=0",
      });

      expect(response.statusCode).toBe(422);
      const body = response.json();
      expect(body.status).toBe(422);
      expect(body.detail).toBe("validation failed");
    });

    it("rejects invalid category with 422 error", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/?category=invalid",
      });

      expect(response.statusCode).toBe(422);
      const body = response.json();
      expect(body.status).toBe(422);
      expect(body.detail).toBe("validation failed");
    });

    it("rethrows non-Error exceptions", async () => {
      const listSpy = vi.spyOn(itemsService.ItemsService.prototype, "list");
      listSpy.mockImplementation(() => {
        throw "string error";
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(500);
      listSpy.mockRestore();
    });
  });
});
