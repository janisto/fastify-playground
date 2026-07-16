import { type Static, Type } from "@fastify/type-provider-typebox";

import { PaginationQuerySchema } from "../../schemas/pagination.js";

export const CategoryEnum = Type.Union([
  Type.Literal("electronics"),
  Type.Literal("tools"),
  Type.Literal("accessories"),
  Type.Literal("robotics"),
  Type.Literal("power"),
  Type.Literal("components"),
]);

export type Category = Static<typeof CategoryEnum>;

const ItemSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  category: CategoryEnum,
  price: Type.Number(),
  inStock: Type.Boolean(),
  createdAt: Type.String({ format: "date-time" }),
  description: Type.String(),
});

export type Item = Static<typeof ItemSchema>;

export const ItemsQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    category: Type.Optional(CategoryEnum),
  }),
]);

export const ItemsResponseSchema = Type.Object(
  {
    items: Type.Array(ItemSchema),
    total: Type.Integer(),
  },
  { $id: "ItemsResponse", description: "Paginated items list" },
);
