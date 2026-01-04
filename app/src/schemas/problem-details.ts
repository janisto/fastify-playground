import { Type } from "@fastify/type-provider-typebox";

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
