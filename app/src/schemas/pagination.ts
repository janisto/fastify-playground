import { Type } from "@fastify/type-provider-typebox";

import { MAX_CURSOR_LENGTH } from "../utils/pagination.js";

export const PaginationQuerySchema = Type.Object({
  cursor: Type.Optional(
    Type.String({ description: "Opaque pagination cursor", minLength: 1, maxLength: MAX_CURSOR_LENGTH }),
  ),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
