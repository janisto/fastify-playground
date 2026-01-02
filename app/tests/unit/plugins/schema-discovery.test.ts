import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type, TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import { decode as cborDecode } from "cbor2";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import acceptsSerializerPlugin from "../../../src/plugins/accepts-serializer.js";
import schemaDiscovery from "../../../src/plugins/schema-discovery.js";

describe("Schema Discovery Plugin", () => {
  describe("Plugin Registration", () => {
    it("should register the plugin successfully", async () => {
      const fastify = Fastify();
      await fastify.register(schemaDiscovery);
      await fastify.ready();
      await fastify.close();
    });
  });

  describe("$schema Field Injection", () => {
    it("should add $schema field to JSON responses with schema $id", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          message: Type.String(),
        },
        { $id: "TestResponse" },
      );

      fastify.get(
        "/test",
        {
          schema: {
            response: {
              200: ResponseSchema,
            },
          },
        },
        async () => {
          return { message: "hello" };
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.$schema).toBe("http://localhost:80/schemas/TestResponse.json");
      expect(body.message).toBe("hello");

      await fastify.close();
    });

    it("should not add $schema field when response schema has no $id", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      fastify.get(
        "/test",
        {
          schema: {
            response: {
              200: Type.Object({
                message: Type.String(),
              }),
            },
          },
        },
        async () => {
          return { message: "hello" };
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.$schema).toBeUndefined();
      expect(body.message).toBe("hello");

      await fastify.close();
    });

    it("should not add $schema field to error responses", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      fastify.get("/error", async () => {
        const error = new Error("Test error") as Error & { statusCode: number };
        error.statusCode = 400;
        throw error;
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/error",
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.$schema).toBeUndefined();

      await fastify.close();
    });

    it("should pass through null payload with schema unchanged", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Null({ $id: "NullResponse" });

      fastify.get(
        "/null",
        {
          schema: {
            response: {
              204: ResponseSchema,
            },
          },
        },
        async (_request, reply) => {
          return reply.code(204).send();
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/null",
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
      expect(response.headers.link).toBe('</schemas/NullResponse.json>; rel="describedBy"');

      await fastify.close();
    });

    it("should pass through non-JSON payloads unchanged", async () => {
      const fastify = Fastify();
      await fastify.register(schemaDiscovery);

      fastify.get("/text", async (_request, reply) => {
        return reply.type("text/plain").send("plain text response");
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/text",
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe("plain text response");

      await fastify.close();
    });

    it("should handle invalid JSON payload gracefully", async () => {
      const fastify = Fastify();
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          data: Type.String(),
        },
        { $id: "InvalidSchema" },
      );

      fastify.get(
        "/raw",
        {
          schema: {
            response: {
              200: ResponseSchema,
            },
          },
        },
        async (_request, reply) => {
          reply.serializer((payload) => payload as string);
          return reply.type("application/json").send("not valid json");
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/raw",
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe("not valid json");

      await fastify.close();
    });
  });

  describe("Link Header", () => {
    it("should add Link header with describedBy relation", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          message: Type.String(),
        },
        { $id: "LinkTestResponse" },
      );

      fastify.get(
        "/test",
        {
          schema: {
            response: {
              200: ResponseSchema,
            },
          },
        },
        async () => {
          return { message: "hello" };
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.link).toBe('</schemas/LinkTestResponse.json>; rel="describedBy"');

      await fastify.close();
    });

    it("should not add Link header when no schema $id", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      fastify.get(
        "/test",
        {
          schema: {
            response: {
              200: Type.Object({
                message: Type.String(),
              }),
            },
          },
        },
        async () => {
          return { message: "hello" };
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.link).toBeUndefined();

      await fastify.close();
    });

    it("should not add Link header to error responses", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          data: Type.String(),
        },
        { $id: "ErrorTestResponse" },
      );

      fastify.get(
        "/error",
        {
          schema: {
            response: {
              200: ResponseSchema,
            },
          },
        },
        async () => {
          const error = new Error("Test error") as Error & { statusCode: number };
          error.statusCode = 500;
          throw error;
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/error",
      });

      expect(response.statusCode).toBe(500);
      expect(response.headers.link).toBeUndefined();

      await fastify.close();
    });
  });

  describe("Schema URL Building", () => {
    it("should use x-forwarded-proto header when present", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          message: Type.String(),
        },
        { $id: "ProtoTestResponse" },
      );

      fastify.get(
        "/test",
        {
          schema: {
            response: {
              200: ResponseSchema,
            },
          },
        },
        async () => {
          return { message: "hello" };
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          "x-forwarded-proto": "https",
          host: "example.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.$schema).toBe("https://example.com/schemas/ProtoTestResponse.json");

      await fastify.close();
    });

    it("should use host header in schema URL", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          message: Type.String(),
        },
        { $id: "HostTestResponse" },
      );

      fastify.get(
        "/test",
        {
          schema: {
            response: {
              200: ResponseSchema,
            },
          },
        },
        async () => {
          return { message: "hello" };
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          host: "api.example.com:8080",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.$schema).toBe("http://api.example.com:8080/schemas/HostTestResponse.json");

      await fastify.close();
    });
  });

  describe("Different HTTP Methods", () => {
    it("should add $schema field to POST responses", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          created: Type.Boolean(),
        },
        { $id: "PostResponse" },
      );

      fastify.post(
        "/test",
        {
          schema: {
            response: {
              201: ResponseSchema,
            },
          },
        },
        async (_request, reply) => {
          return reply.code(201).send({ created: true });
        },
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/test",
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.$schema).toBe("http://localhost:80/schemas/PostResponse.json");
      expect(body.created).toBe(true);

      await fastify.close();
    });

    it("should add $schema field to PUT responses", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          updated: Type.Boolean(),
        },
        { $id: "PutResponse" },
      );

      fastify.put(
        "/test",
        {
          schema: {
            response: {
              200: ResponseSchema,
            },
          },
        },
        async () => {
          return { updated: true };
        },
      );

      const response = await fastify.inject({
        method: "PUT",
        url: "/test",
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.$schema).toBe("http://localhost:80/schemas/PutResponse.json");
      expect(body.updated).toBe(true);

      await fastify.close();
    });
  });

  describe("CBOR Support", () => {
    it("should add $schema field to CBOR responses", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(acceptsSerializerPlugin);
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          message: Type.String(),
        },
        { $id: "CborTestResponse" },
      );

      fastify.get(
        "/test",
        {
          schema: {
            response: {
              200: ResponseSchema,
            },
          },
        },
        async () => {
          return { message: "hello" };
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          Accept: "application/cbor",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("application/cbor");
      expect(response.headers.link).toBe('</schemas/CborTestResponse.json>; rel="describedBy"');

      const body = cborDecode(new Uint8Array(response.rawPayload)) as Record<string, unknown>;
      expect(body.$schema).toBe("http://localhost:80/schemas/CborTestResponse.json");
      expect(body.message).toBe("hello");

      await fastify.close();
    });

    it("should add Link header to CBOR responses", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(acceptsSerializerPlugin);
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          data: Type.String(),
        },
        { $id: "CborLinkTestResponse" },
      );

      fastify.get(
        "/test",
        {
          schema: {
            response: {
              200: ResponseSchema,
            },
          },
        },
        async () => {
          return { data: "test" };
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          Accept: "application/cbor",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers.link).toBe('</schemas/CborLinkTestResponse.json>; rel="describedBy"');

      await fastify.close();
    });

    it("should handle invalid CBOR data gracefully", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(acceptsSerializerPlugin);
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object(
        {
          data: Type.String(),
        },
        { $id: "CborInvalidTestResponse" },
      );

      fastify.get(
        "/test",
        {
          schema: {
            response: {
              200: ResponseSchema,
            },
          },
        },
        async (_request, reply) => {
          reply.type("application/cbor");
          return reply.send(Buffer.from([0xff, 0xff, 0xff]));
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
        headers: {
          Accept: "application/cbor",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("application/cbor");
      expect(response.rawPayload).toEqual(Buffer.from([0xff, 0xff, 0xff]));

      await fastify.close();
    });
  });

  describe("Schema $ref Support", () => {
    it("should extract schema name from $ref", async () => {
      const fastify = Fastify().setValidatorCompiler(TypeBoxValidatorCompiler).withTypeProvider<TypeBoxTypeProvider>();
      await fastify.register(schemaDiscovery);

      const ResponseSchema = Type.Object({
        message: Type.String(),
      });

      fastify.addSchema({
        $id: "RefTestResponse",
        ...ResponseSchema,
      });

      fastify.get(
        "/test",
        {
          schema: {
            response: {
              200: { $ref: "RefTestResponse" },
            },
          },
        },
        async () => {
          return { message: "hello" };
        },
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/test",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.$schema).toBe("http://localhost:80/schemas/RefTestResponse.json");
      expect(response.headers.link).toBe('</schemas/RefTestResponse.json>; rel="describedBy"');

      await fastify.close();
    });
  });
});
