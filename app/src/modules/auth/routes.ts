import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";

import { ErrorModelSchema } from "../../schemas/index.js";
import { API_MEDIA_TYPES } from "../../utils/content-negotiation.js";
import { AuthenticatedUserSchema } from "./schemas.js";

const UnauthorizedErrorSchema = {
  ...ErrorModelSchema,
  headers: {
    "WWW-Authenticate": Type.String({
      description: "RFC 6750 Bearer authentication challenge",
    }),
  },
};

const authRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.addSchema(AuthenticatedUserSchema);

  fastify.get(
    "/me",
    {
      preHandler: [fastify.authenticate],
      schema: {
        operationId: "getAuthenticatedUser",
        description: "Returns the minimal identity from a verified Firebase ID token",
        summary: "Get authenticated user",
        tags: ["Authentication"],
        security: [{ bearerAuth: [] }],
        produces: API_MEDIA_TYPES,
        response: {
          200: AuthenticatedUserSchema,
          400: ErrorModelSchema,
          401: UnauthorizedErrorSchema,
          406: ErrorModelSchema,
          500: ErrorModelSchema,
          503: ErrorModelSchema,
        },
      },
    },
    async (request) => {
      if (request.user === null) {
        throw fastify.httpErrors.internalServerError("Authenticated user context is missing");
      }
      return { userId: request.user.uid };
    },
  );
};

export default authRoutes;
