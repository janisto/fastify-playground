import { Type } from "@fastify/type-provider-typebox";
import { BoundedNameSchema } from "../../schemas/portable.js";

export const HelloResponseSchema = Type.Object(
  {
    message: Type.String({ description: "Greeting message", examples: ["Hello, World!"] }),
  },
  {
    $id: "HelloResponse",
    additionalProperties: false,
    description: "Successful response with greeting message",
  },
);

export const HelloInputSchema = Type.Object(
  {
    name: BoundedNameSchema,
  },
  { additionalProperties: false },
);
