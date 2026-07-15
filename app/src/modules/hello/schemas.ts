import { Type } from "@fastify/type-provider-typebox";

export const HelloResponseSchema = Type.Object(
  {
    message: Type.String({ description: "Greeting message", examples: ["Hello, World!"] }),
  },
  {
    $id: "HelloResponse",
    description: "Successful response with greeting message",
  },
);

export const HelloInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 100, description: "Name to greet" }),
  },
  { additionalProperties: false },
);
