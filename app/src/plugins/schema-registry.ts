import { Type } from "@fastify/type-provider-typebox";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const CategoryEnum = Type.Union([
  Type.Literal("electronics"),
  Type.Literal("tools"),
  Type.Literal("accessories"),
  Type.Literal("robotics"),
  Type.Literal("power"),
  Type.Literal("components"),
]);

const ItemSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  category: CategoryEnum,
  price: Type.Number(),
  inStock: Type.Boolean(),
  createdAt: Type.String({ format: "date-time" }),
  description: Type.String(),
});

export const HealthResponseSchema = Type.Object(
  {
    $schema: Type.Optional(Type.String()),
    status: Type.Literal("healthy", {
      description: "Health status indicator",
      examples: ["healthy"],
    }),
  },
  {
    $id: "HealthResponse",
    description: "Successful response indicating the API is healthy",
  },
);

export const HelloResponseSchema = Type.Object(
  {
    $schema: Type.Optional(Type.String()),
    message: Type.String({ description: "Greeting message", examples: ["Hello, World!"] }),
  },
  {
    $id: "HelloResponse",
    description: "Successful response with greeting message",
  },
);

export const ItemsResponseSchema = Type.Object(
  {
    $schema: Type.Optional(Type.String()),
    items: Type.Array(ItemSchema),
    total: Type.Integer(),
  },
  { $id: "ItemsResponse", description: "Paginated items list" },
);

export const ProblemDetailsSchema = Type.Object(
  {
    $schema: Type.Optional(Type.String()),
    type: Type.Optional(Type.String({ default: "about:blank" })),
    title: Type.String(),
    status: Type.Integer(),
    detail: Type.Optional(Type.String()),
    instance: Type.Optional(Type.String()),
  },
  { $id: "ProblemDetails", description: "RFC 9457 Problem Details" },
);

const ErrorDetailSchema = Type.Object({
  message: Type.String({ description: "Error message text" }),
  location: Type.Optional(
    Type.String({ description: "Where the error occurred, e.g. 'body.items[3].tags' or 'path.thing-id'" }),
  ),
  value: Type.Optional(Type.Unknown({ description: "The value at the given location" })),
});

export const ErrorModelSchema = Type.Object(
  {
    $schema: Type.Optional(
      Type.String({ format: "uri", readOnly: true, description: "A URL to the JSON Schema for this object." }),
    ),
    type: Type.Optional(
      Type.String({
        format: "uri",
        default: "about:blank",
        description: "A URI reference to human-readable documentation for the error.",
      }),
    ),
    title: Type.String({ description: "A short, human-readable summary of the problem type." }),
    status: Type.Integer({ description: "HTTP status code" }),
    detail: Type.Optional(
      Type.String({ description: "A human-readable explanation specific to this occurrence of the problem." }),
    ),
    instance: Type.Optional(
      Type.String({
        format: "uri",
        description: "A URI reference that identifies the specific occurrence of the problem.",
      }),
    ),
    errors: Type.Optional(Type.Array(ErrorDetailSchema, { description: "Optional list of individual error details" })),
  },
  { $id: "ErrorModel", description: "RFC 9457 Problem Details with error list" },
);

const schemaRegistryPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addSchema(HealthResponseSchema);
  fastify.addSchema(HelloResponseSchema);
  fastify.addSchema(ItemsResponseSchema);
  fastify.addSchema(ProblemDetailsSchema);
  fastify.addSchema(ErrorModelSchema);
};

export default fp(schemaRegistryPlugin, {
  fastify: "5.x",
  name: "@app/schema-registry",
});
