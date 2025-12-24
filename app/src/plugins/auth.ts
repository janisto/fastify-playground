import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Options for the Firebase Authentication plugin.
 */
export interface AuthPluginOptions {
  /**
   * Whether to check if the token has been revoked.
   * When true, adds an extra database lookup to verify the token hasn't been revoked.
   * Use this for high-security routes where immediate session invalidation is required.
   *
   * @default false
   * @see https://firebase.google.com/docs/auth/admin/manage-sessions
   */
  checkRevoked?: boolean;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: DecodedIdToken | null;
  }
}

/**
 * Firebase Authentication plugin for Fastify.
 *
 * This plugin provides:
 * - `fastify.authenticate` preHandler for protecting routes
 * - `request.user` containing the decoded Firebase ID token
 *
 * Usage:
 * ```typescript
 * // Protect a single route
 * fastify.get('/protected', { preHandler: [fastify.authenticate] }, handler);
 *
 * // Protect all routes in a plugin
 * fastify.addHook('preHandler', fastify.authenticate);
 * ```
 *
 * The token is expected in the Authorization header:
 * ```
 * Authorization: Bearer <firebase-id-token>
 * ```
 *
 * Options:
 * - `checkRevoked` (boolean): When true, verifies the token hasn't been revoked.
 *   This adds an extra database lookup but provides enhanced security for
 *   scenarios requiring immediate session invalidation.
 *
 * @see https://firebase.google.com/docs/auth/admin/verify-id-tokens
 * @see https://firebase.google.com/docs/auth/admin/manage-sessions
 */
export default fp<AuthPluginOptions>(
  async (fastify, options) => {
    const { checkRevoked = false } = options;

    // Decorate request with user placeholder
    fastify.decorateRequest("user", null);

    // Authentication preHandler
    const authenticate = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        throw fastify.httpErrors.unauthorized("Missing authorization header");
      }

      const [scheme, token] = authHeader.split(" ");

      if (scheme?.toLowerCase() !== "bearer" || !token) {
        throw fastify.httpErrors.unauthorized("Invalid authorization header format. Expected: Bearer <token>");
      }

      try {
        const decodedToken = await fastify.firebaseAuth.verifyIdToken(token, checkRevoked);
        request.user = decodedToken;
      } catch (error) {
        const firebaseError = error as { code?: string };
        if (firebaseError.code === "auth/id-token-revoked") {
          request.log.warn({ error }, "Firebase token has been revoked");
          throw fastify.httpErrors.unauthorized("Token has been revoked. Please sign in again.");
        }
        request.log.warn({ error }, "Firebase token verification failed");
        throw fastify.httpErrors.unauthorized("Invalid or expired token");
      }
    };

    fastify.decorate("authenticate", authenticate);
  },
  {
    name: "auth",
    fastify: "5.x",
    dependencies: ["firebase", "sensible"],
  },
);
