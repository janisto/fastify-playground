import { type Static, Type } from "@fastify/type-provider-typebox";

import { SafeIntegerSchema } from "../../schemas/portable.js";
import { MAX_CURSOR_LENGTH } from "../../utils/pagination.js";
import { ITEM_CATALOG } from "./catalog.js";

export const CategoryEnum = Type.Union([
  Type.Literal("electronics"),
  Type.Literal("tools"),
  Type.Literal("accessories"),
  Type.Literal("robotics"),
  Type.Literal("power"),
  Type.Literal("components"),
]);

export type Category = Static<typeof CategoryEnum>;

function exactItemSchema(item: (typeof ITEM_CATALOG)[number]) {
  return Type.Object(
    {
      id: Type.Literal(item.id),
      name: Type.Literal(item.name),
      category: Type.Literal(item.category),
      price: Type.Object(
        {
          amountMinor: Type.Literal(item.price.amountMinor),
          currency: Type.Literal(item.price.currency),
        },
        { additionalProperties: false },
      ),
      inStock: Type.Literal(item.inStock),
      createdAt: Type.Literal(item.createdAt),
      description: Type.Literal(item.description),
    },
    { additionalProperties: false },
  );
}

const ItemSchema = Type.Union([
  exactItemSchema(ITEM_CATALOG[0]),
  ...ITEM_CATALOG.slice(1).map((item) => exactItemSchema(item)),
]);

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
