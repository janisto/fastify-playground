import { type Static, Type } from "@fastify/type-provider-typebox";

export const AuthenticatedUserSchema = Type.Object(
  {
    userId: Type.String({ description: "Verified Firebase user identifier" }),
  },
  {
    $id: "AuthenticatedUser",
    description: "Minimal identity projected from a verified Firebase ID token",
  },
);

export type AuthenticatedUser = Static<typeof AuthenticatedUserSchema>;
