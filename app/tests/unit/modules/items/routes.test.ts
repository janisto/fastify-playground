import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { itemsRoutes } from "../../../../src/modules/items/index.js";
import { ItemsService } from "../../../../src/modules/items/service.js";
import errorHandler from "../../../../src/plugins/error-handler.js";
import sensible from "../../../../src/plugins/sensible.js";
import { encodeCursor } from "../../../../src/utils/pagination.js";

describe("items routes", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler);
    fastify.register(sensible);
    fastify.register(errorHandler);
    fastify.register(itemsRoutes);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.restoreAllMocks();
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
      const cursor = encodeCursor({ type: "item", value: "20:*:item-005" });
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
      const cursor = encodeCursor({ type: "item", value: "5:*:item-005" });
      expect(response.headers.link).toBe(`</v1/items?cursor=${cursor}&limit=5>; rel="next"`);
    });

    it("rejects a cursor after the client changes the page size", async () => {
      const firstPage = await fastify.inject({ method: "GET", url: "/?limit=5" });
      const link = firstPage.headers.link;
      const nextUrl = /<([^>]+)>; rel="next"/.exec(Array.isArray(link) ? link.join(", ") : (link ?? ""))?.[1];
      if (!nextUrl) throw new Error("expected a next-page link");

      const response = await fastify.inject({
        method: "GET",
        url: `/?${new URL(nextUrl, "http://example.test").searchParams.toString().replace("limit=5", "limit=10")}`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().detail).toContain("cursor does not match the requested category or limit");
    });

    it.each([
      [1, 1],
      [100, 30],
    ])("accepts the inclusive limit boundary %i", async (limit, expectedItems) => {
      const response = await fastify.inject({ method: "GET", url: `/?limit=${limit}` });

      expect(response.statusCode).toBe(200);
      expect(response.json().items).toHaveLength(expectedItems);
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

    it("does not misclassify an unexpected service failure as a client cursor error", async () => {
      vi.spyOn(ItemsService.prototype, "list").mockImplementationOnce(() => {
        throw new Error("unexpected-service-failure-canary");
      });

      const response = await fastify.inject({ method: "GET", url: "/" });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({ status: 500, title: "Internal Server Error" });
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
  });
});
