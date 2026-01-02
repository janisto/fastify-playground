import { Type } from "@fastify/type-provider-typebox";

export const PaginationQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String({ description: "Opaque pagination cursor" })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});

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

export const ValidationProblemSchema = Type.Intersect(
  [
    ProblemDetailsSchema,
    Type.Object({
      errors: Type.Array(
        Type.Object({
          field: Type.String(),
          message: Type.String(),
          pointer: Type.Optional(Type.String()),
        }),
      ),
    }),
  ],
  { $id: "ValidationProblem" },
);

export const TimestampSchema = Type.String({
  format: "date-time",
  description: "ISO 8601 timestamp in UTC",
  examples: ["2026-01-02T14:30:00.000Z"],
});
