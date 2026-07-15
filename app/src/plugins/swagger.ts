import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { OpenAPIV3_1 } from "openapi-types";
import { CBOR_MEDIA_TYPE, JSON_MEDIA_TYPE, PROBLEM_JSON_MEDIA_TYPE } from "../utils/content-negotiation.js";

interface SchemaWithId {
  $id?: string;
}

const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

const COMMON_RESPONSE_HEADERS: Record<string, OpenAPIV3_1.HeaderObject> = {
  Vary: {
    description: "Request headers that can change the selected representation.",
    schema: { type: "string" },
    example: "Accept, Origin",
  },
  "X-Request-ID": {
    description: "Validated client request ID or a server-generated UUID.",
    schema: { type: "string" },
  },
  Link: {
    description: "JSON Schema discovery and, where applicable, pagination links.",
    schema: { type: "string" },
  },
};

function alignResponseHeaders(status: string, response: OpenAPIV3_1.ResponseObject): void {
  response.headers = { ...COMMON_RESPONSE_HEADERS, ...response.headers };
  if (status === "429" || status === "503") {
    response.headers["Retry-After"] = {
      description: "Delay in seconds before retrying the request.",
      schema: { type: "string" },
    };
  }
}

function alignOperationResponses(operation: OpenAPIV3_1.OperationObject): void {
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    if ("$ref" in response) continue;
    alignResponseHeaders(status, response);
    if (Number(status) < 400 || !response.content) continue;

    const schema = response.content[JSON_MEDIA_TYPE]?.schema ?? Object.values(response.content)[0]?.schema;
    if (!schema) continue;

    response.content = {
      [PROBLEM_JSON_MEDIA_TYPE]: { schema },
      [CBOR_MEDIA_TYPE]: { schema },
    };
  }
}

function alignOpenApiContract(openapiObject: Partial<OpenAPIV3_1.Document>): Partial<OpenAPIV3_1.Document> {
  for (const pathItem of Object.values(openapiObject.paths ?? {})) {
    if (!pathItem || "$ref" in pathItem) continue;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation) alignOperationResponses(operation);
    }
  }

  return openapiObject;
}

/**
 * OpenAPI/Swagger documentation plugin for Fastify.
 *
 * This plugin provides:
 * - Automatic OpenAPI 3.1.0 specification generation
 * - Interactive Swagger UI at /api-docs
 * - JSON spec available at /api-docs/json
 * - YAML spec available at /api-docs/yaml
 * - JWT Bearer authentication scheme configured
 *
 * The documentation is auto-generated from:
 * - Route schemas defined in route handlers
 * - JSDoc comments on route handlers
 * - Schema definitions in route options
 *
 * Access the documentation at:
 * - UI: http://localhost:3000/api-docs
 * - JSON: http://localhost:3000/api-docs/json
 * - YAML: http://localhost:3000/api-docs/yaml
 *
 * @see https://github.com/fastify/fastify-swagger
 * @see https://github.com/fastify/fastify-swagger-ui
 */
const swaggerPlugin: FastifyPluginAsync = async (fastify): Promise<void> => {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Fastify Playground API",
        description: "A REST API built with Fastify and TypeScript",
        version: "1.0.0",
      },
      servers: [
        {
          url: "/",
          description: "Current server",
        },
      ],
      tags: [
        { name: "Health", description: "Process liveness and readiness" },
        { name: "Authentication", description: "Firebase-authenticated identity" },
        { name: "Hello", description: "Greeting examples" },
        { name: "Items", description: "Paginated item examples" },
        { name: "GitHub", description: "Public GitHub data" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Firebase ID token. Obtain from Firebase Authentication SDK on the client.",
          },
        },
      },
    },
    refResolver: {
      buildLocalReference(json: SchemaWithId, _baseUri, _fragment, i) {
        /* v8 ignore next -- @preserve */
        return json.$id ?? `def-${i}`;
      },
    },
    transformObject: (documentObject) => {
      if ("openapiObject" in documentObject) {
        return alignOpenApiContract(documentObject.openapiObject as Partial<OpenAPIV3_1.Document>);
      }
      return documentObject.swaggerObject;
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: "/api-docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
};

export default fp(swaggerPlugin, {
  name: "swagger",
  fastify: "5.x",
});
