import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { OpenAPIV3_1 } from "openapi-types";
import { CBOR_MEDIA_TYPE, JSON_MEDIA_TYPE, PROBLEM_JSON_MEDIA_TYPE } from "../utils/content-negotiation.js";
import { PORTABLE_ERRORS, type PortableErrorCode } from "../utils/portable-error.js";

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
    description: "Validated client request ID or a generated 32-character lowercase hexadecimal replacement.",
    schema: { type: "string", minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$" },
  },
  "Cache-Control": {
    description: "Prevents storage of dynamic API and error responses.",
    schema: { type: "string", enum: ["no-store"] },
  },
  "X-Content-Type-Options": {
    description: "Disables content sniffing.",
    schema: { type: "string", enum: ["nosniff"] },
  },
  "X-Frame-Options": {
    description: "Prevents framing.",
    schema: { type: "string", enum: ["DENY"] },
  },
  "Referrer-Policy": {
    description: "Controls referrer disclosure.",
    schema: { type: "string", enum: ["strict-origin-when-cross-origin"] },
  },
};

const RETRY_AFTER_HEADER: OpenAPIV3_1.HeaderObject = {
  description: "Delay in seconds before retrying the request.",
  schema: { type: "integer", minimum: 0, maximum: 9_007_199_254_740_991 },
};

function alignResponseHeaders(status: string, response: OpenAPIV3_1.ResponseObject): void {
  response.headers = { ...COMMON_RESPONSE_HEADERS, ...response.headers };
  if (status !== "204") {
    response.headers["Link"] = {
      description: 'RFC 8288 link to the response schema using rel="describedby".',
      schema: { type: "string" },
    };
  }
  if (status === "429" || status === "503") {
    response.headers["Retry-After"] = RETRY_AFTER_HEADER;
  }
}

function operationErrorCode(operationId: string | undefined, status: string): PortableErrorCode | undefined {
  switch (status) {
    case "400":
      return "invalid_request";
    case "401":
      return "unauthorized";
    case "404":
      return operationId?.startsWith("getGitHub") || operationId?.startsWith("listGitHub")
        ? "github_not_found"
        : "profile_not_found";
    case "406":
      return "not_acceptable";
    case "409":
      return "profile_exists";
    case "413":
      return "payload_too_large";
    case "415":
      return "unsupported_media_type";
    case "422":
      return "validation_failed";
    case "429":
      return "github_rate_limit";
    case "500":
      return "internal_error";
    case "502":
      return "github_upstream";
    case "503":
      return "dependency_unavailable";
    case "504":
      return "github_timeout";
    default:
      return undefined;
  }
}

function exactErrorSchema(
  schema: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject,
  code: PortableErrorCode,
): OpenAPIV3_1.SchemaObject {
  const definition = PORTABLE_ERRORS[code];
  return {
    allOf: [
      schema,
      {
        type: "object",
        properties: {
          title: { const: definition.title },
          status: { const: definition.status },
          detail: { const: definition.detail },
          code: { const: code },
        },
      },
    ],
  };
}

function alignOperationResponses(operation: OpenAPIV3_1.OperationObject): void {
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    if ("$ref" in response) continue;
    alignResponseHeaders(status, response);
    if (Number(status) < 400 || !response.content) continue;

    const schema = response.content[JSON_MEDIA_TYPE]?.schema ?? Object.values(response.content)[0]?.schema;
    if (!schema) continue;
    const code = operationErrorCode(operation.operationId, status);
    const projectedSchema = code === undefined ? schema : exactErrorSchema(schema, code);

    response.content = {
      [PROBLEM_JSON_MEDIA_TYPE]: { schema: projectedSchema },
      [CBOR_MEDIA_TYPE]: { schema: projectedSchema },
    };
  }
}

const PAGINATED_OPERATION_IDS = new Set([
  "listItems",
  "listGitHubOwnerRepositories",
  "listGitHubRepositoryActivity",
  "listGitHubRepositoryTags",
]);

const CLOSED_QUERY_OPERATION_IDS = new Set([
  "getHealth",
  "getReadiness",
  "getAuthenticatedUser",
  "getHello",
  "createHello",
  "listItems",
  "createProfile",
  "getProfile",
  "updateProfile",
  "deleteProfile",
  "getGitHubOwner",
  "listGitHubOwnerRepositories",
  "getGitHubRepository",
  "listGitHubRepositoryActivity",
  "listGitHubRepositoryLanguages",
  "listGitHubRepositoryTags",
]);

function alignClosedQueryDescription(operation: OpenAPIV3_1.OperationObject): void {
  if (!operation.operationId || !CLOSED_QUERY_OPERATION_IDS.has(operation.operationId)) return;
  const sentence = PAGINATED_OPERATION_IDS.has(operation.operationId)
    ? "Only the documented query parameters are accepted; unknown, repeated, or malformed query input is rejected."
    : "No query parameters are accepted; unknown, repeated, or malformed query input is rejected.";
  if (operation.description?.endsWith(sentence)) return;
  const description = operation.description?.trim();
  const separator = description && !/[.!?]$/.test(description) ? ". " : " ";
  operation.description = description ? `${description}${separator}${sentence}` : sentence;
}

function alignParameterSerialization(parameter: OpenAPIV3_1.ParameterObject): void {
  if (parameter.in === "query") {
    parameter.style = "form";
    parameter.explode = true;
  } else if (parameter.in === "path" || parameter.in === "header") {
    parameter.style = "simple";
    parameter.explode = false;
  }
}

function alignOperation(operation: OpenAPIV3_1.OperationObject): void {
  alignOperationResponses(operation);
  alignClosedQueryDescription(operation);
  operation.parameters ??= [];
  operation.parameters.push({
    name: "X-Request-ID",
    in: "header",
    required: false,
    description: "A missing, invalid, repeated, or comma-combined candidate is replaced rather than rejected.",
    schema: { type: "string", minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$" },
  });
  for (const parameter of operation.parameters) {
    if (!("$ref" in parameter)) alignParameterSerialization(parameter);
  }

  const success = operation.responses?.["200"];
  if (operation.operationId && PAGINATED_OPERATION_IDS.has(operation.operationId) && success && !("$ref" in success)) {
    success.headers = {
      ...success.headers,
      Link: {
        description: "RFC 8288 describedby link plus optional next and previous navigation.",
        schema: { type: "string" },
      },
    };
  }
  const created = operation.responses?.["201"];
  if (operation.operationId === "createProfile" && created && !("$ref" in created)) {
    created.headers = {
      ...created.headers,
      Location: {
        description: "Canonical current-principal profile path.",
        schema: { type: "string", enum: ["/v1/profile"] },
      },
    };
  }
  const unauthorized = operation.responses?.["401"];
  if (unauthorized && !("$ref" in unauthorized)) {
    unauthorized.headers = {
      ...unauthorized.headers,
      "WWW-Authenticate": { description: "Firebase bearer challenge.", schema: { type: "string", enum: ["Bearer"] } },
    };
  }
  const quota = operation.responses?.["429"];
  if (quota && !("$ref" in quota)) {
    quota.headers = {
      ...quota.headers,
      "X-RateLimit-Reset": {
        description: "Optional validated GitHub reset epoch.",
        schema: { type: "integer", minimum: 0, maximum: 9_007_199_254_740_991 },
      },
    };
  }
  const empty = operation.responses?.["204"];
  if (empty && !("$ref" in empty)) delete empty.content;
}

function alignOpenApiContract(openapiObject: Partial<OpenAPIV3_1.Document>): Partial<OpenAPIV3_1.Document> {
  for (const pathItem of Object.values(openapiObject.paths ?? {})) {
    if (!pathItem || "$ref" in pathItem) continue;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation) alignOperation(operation);
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
        { name: "Profiles", description: "Authenticated current-principal profile" },
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
      url: "/openapi.json",
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  fastify.get(
    "/openapi.json",
    {
      schema: {
        hide: true,
        produces: [JSON_MEDIA_TYPE],
      },
    },
    async (_request, reply) => reply.type(JSON_MEDIA_TYPE).send(fastify.swagger()),
  );
};

export default fp(swaggerPlugin, {
  name: "swagger",
  fastify: "5.x",
});
