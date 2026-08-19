import { Type } from "@fastify/type-provider-typebox";

const ErrorSourceSchema = Type.Union([
  Type.Object({ pointer: Type.String({ minLength: 1, maxLength: 256 }) }, { additionalProperties: false }),
  Type.Object({ parameter: Type.String({ minLength: 1, maxLength: 256 }) }, { additionalProperties: false }),
  Type.Object({ header: Type.String({ minLength: 1, maxLength: 256 }) }, { additionalProperties: false }),
]);

const ErrorDetailSchema = Type.Object(
  {
    detail: Type.String({ minLength: 1, maxLength: 200 }),
    source: Type.Optional(ErrorSourceSchema),
  },
  { additionalProperties: false },
);

const ErrorCodeSchema = Type.Union([
  Type.Literal("invalid_request"),
  Type.Literal("unauthorized"),
  Type.Literal("forbidden"),
  Type.Literal("client_generated_id_unsupported"),
  Type.Literal("relationships_unsupported"),
  Type.Literal("not_found"),
  Type.Literal("profile_not_found"),
  Type.Literal("github_not_found"),
  Type.Literal("method_not_allowed"),
  Type.Literal("not_acceptable"),
  Type.Literal("profile_exists"),
  Type.Literal("profile_resource_mismatch"),
  Type.Literal("payload_too_large"),
  Type.Literal("unsupported_media_type"),
  Type.Literal("validation_failed"),
  Type.Literal("rate_limited"),
  Type.Literal("github_rate_limit"),
  Type.Literal("internal_error"),
  Type.Literal("github_upstream"),
  Type.Literal("dependency_unavailable"),
  Type.Literal("github_timeout"),
]);

export const ErrorModelSchema = Type.Object(
  {
    type: Type.Optional(Type.Literal("about:blank")),
    title: Type.String({ minLength: 1 }),
    status: Type.Integer({ minimum: 400, maximum: 599 }),
    detail: Type.String({ minLength: 1 }),
    code: ErrorCodeSchema,
    errors: Type.Optional(Type.Array(ErrorDetailSchema, { minItems: 1, maxItems: 32 })),
  },
  { $id: "ErrorModel", additionalProperties: false, description: "Closed RFC 9457 Problem Details" },
);
