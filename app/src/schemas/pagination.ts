import { Type } from "@fastify/type-provider-typebox";

export const PaginationQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String({ description: "Opaque pagination cursor" })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
