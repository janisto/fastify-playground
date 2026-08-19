import { type Static, Type } from "@fastify/type-provider-typebox";

import {
  BoundedNameSchema,
  MoneySchema,
  OpaqueIdSchema,
  SafeIntegerSchema,
  TimestampSchema,
} from "../../schemas/portable.js";
import { MAX_CURSOR_LENGTH } from "../../utils/pagination.js";

export const CategoryEnum = Type.Union([
  Type.Literal("electronics"),
  Type.Literal("tools"),
  Type.Literal("accessories"),
  Type.Literal("robotics"),
  Type.Literal("power"),
  Type.Literal("components"),
]);

export type Category = Static<typeof CategoryEnum>;

const ItemSchema = Type.Object(
  {
    id: OpaqueIdSchema,
    name: BoundedNameSchema,
    category: CategoryEnum,
    price: MoneySchema,
    inStock: Type.Boolean(),
    createdAt: TimestampSchema,
    description: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);

export type Item = Static<typeof ItemSchema>;

export const ItemsQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({ minLength: 1, maxLength: MAX_CURSOR_LENGTH, pattern: "^[!-~]+$" })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
    category: Type.Optional(CategoryEnum),
  },
  { additionalProperties: false },
);

export const ItemsResponseSchema = Type.Object(
  {
    items: Type.Array(ItemSchema, { maxItems: 100 }),
    total: SafeIntegerSchema,
  },
  { $id: "ItemsResponse", additionalProperties: false, description: "Paginated items list" },
);
