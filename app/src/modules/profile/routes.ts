import { type FastifyPluginAsyncTypebox, Type } from "@fastify/type-provider-typebox";
import { getFirestore } from "firebase-admin/firestore";
import { registerMissingMediaTypeParser } from "../../plugins/request-body.js";
import { ErrorModelSchema } from "../../schemas/index.js";
import { isOpaqueId } from "../../schemas/portable.js";
import { API_MEDIA_TYPES } from "../../utils/content-negotiation.js";
import { PortableError } from "../../utils/portable-error.js";
import { createLazyFirestoreProfileRepository, type ProfileRepository } from "./repository.js";
import { normalizeProfileDocument, ProfileCreateSchema, ProfileSchema, ProfileUpdateSchema } from "./schemas.js";
import { type ProfileClock, ProfileService } from "./service.js";

export interface ProfileRoutesOptions {
  readonly clock?: ProfileClock;
  readonly repository?: ProfileRepository;
}

function principalId(user: { uid?: unknown } | null): string {
  if (!isOpaqueId(user?.uid)) {
    throw new PortableError("unauthorized");
  }
  return user.uid;
}

const profileRoutes: FastifyPluginAsyncTypebox<ProfileRoutesOptions> = async (fastify, options) => {
  registerMissingMediaTypeParser(fastify);
  const repository =
    options.repository ?? createLazyFirestoreProfileRepository(() => getFirestore(fastify.firebaseAuth.app));
  const service =
    options.clock === undefined ? new ProfileService(repository) : new ProfileService(repository, options.clock);
  const authenticate = { onRequest: [fastify.authenticate] };

  fastify.addSchema(ProfileSchema);

  fastify.post(
    "/",
    {
      prefixTrailingSlash: "no-slash",
      ...authenticate,
      preValidation: async (request) => normalizeProfileDocument(request.body),
      schema: {
        operationId: "createProfile",
        security: [{ bearerAuth: [] }],
        summary: "Create current profile",
        description:
          "Create the Firebase-authenticated principal's sole profile atomically if absent; callers cannot select another owner. Returns 201 and Location, or 409 profile_exists. After an uncertain outcome, read and reconcile before retrying; an existing profile does not prove this creation succeeded.",
        tags: ["Profiles"],
        consumes: API_MEDIA_TYPES,
        produces: API_MEDIA_TYPES,
        body: ProfileCreateSchema,
        response: {
          201: ProfileSchema,
          400: ErrorModelSchema,
          401: ErrorModelSchema,
          406: ErrorModelSchema,
          409: ErrorModelSchema,
          413: ErrorModelSchema,
          415: ErrorModelSchema,
          422: ErrorModelSchema,
          500: ErrorModelSchema,
          503: ErrorModelSchema,
        },
      },
    },
    async (request, reply) => {
      const profile = await service.create(principalId(request.user), request.body, request.signal);
      return reply.status(201).header("Location", "/v1/profile").send(profile);
    },
  );

  fastify.get(
    "/",
    {
      prefixTrailingSlash: "no-slash",
      ...authenticate,
      schema: {
        operationId: "getProfile",
        security: [{ bearerAuth: [] }],
        summary: "Get current profile",
        description:
          "Read only the Firebase-authenticated principal's profile; callers cannot select another owner. A missing profile returns 404 profile_not_found. This operation does not change stored data.",
        tags: ["Profiles"],
        produces: API_MEDIA_TYPES,
        response: {
          200: ProfileSchema,
          400: ErrorModelSchema,
          401: ErrorModelSchema,
          404: ErrorModelSchema,
          406: ErrorModelSchema,
          500: ErrorModelSchema,
          503: ErrorModelSchema,
        },
      },
    },
    async (request) => service.get(principalId(request.user), request.signal),
  );

  fastify.patch(
    "/",
    {
      prefixTrailingSlash: "no-slash",
      ...authenticate,
      preValidation: async (request) => normalizeProfileDocument(request.body),
      schema: {
        operationId: "updateProfile",
        security: [{ bearerAuth: [] }],
        summary: "Update current profile",
        description:
          "Apply a non-empty partial update to the Firebase-authenticated principal's profile. Omitted fields are preserved; an unchanged update performs no write and preserves updatedAt. Read and reassess an uncertain outcome before retrying, because replay can overwrite intervening changes.",
        tags: ["Profiles"],
        consumes: API_MEDIA_TYPES,
        produces: API_MEDIA_TYPES,
        body: ProfileUpdateSchema,
        response: {
          200: ProfileSchema,
          400: ErrorModelSchema,
          401: ErrorModelSchema,
          404: ErrorModelSchema,
          406: ErrorModelSchema,
          413: ErrorModelSchema,
          415: ErrorModelSchema,
          422: ErrorModelSchema,
          500: ErrorModelSchema,
          503: ErrorModelSchema,
        },
      },
    },
    async (request) => service.update(principalId(request.user), request.body, request.signal),
  );

  fastify.delete(
    "/",
    {
      prefixTrailingSlash: "no-slash",
      ...authenticate,
      schema: {
        operationId: "deleteProfile",
        security: [{ bearerAuth: [] }],
        summary: "Delete current profile",
        description:
          "Delete the Firebase-authenticated principal's profile atomically. Success is an empty 204; a missing profile returns 404 profile_not_found. Repeated effects are idempotent, but another DELETE can remove a later recreation and does not replay the original response.",
        tags: ["Profiles"],
        response: {
          204: Type.Null(),
          400: ErrorModelSchema,
          401: ErrorModelSchema,
          404: ErrorModelSchema,
          500: ErrorModelSchema,
          503: ErrorModelSchema,
        },
      },
    },
    async (request, reply) => {
      await service.delete(principalId(request.user), request.signal);
      return reply.status(204).send(null);
    },
  );
};

export default profileRoutes;
