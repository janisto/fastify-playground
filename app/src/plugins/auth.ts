import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { DecodedIdToken } from "firebase-admin/auth";
import { PortableError } from "../utils/portable-error.js";

/**
 * Options for the Firebase Authentication plugin.
 */
export interface AuthPluginOptions {
  /**
   * Whether to check if the token has been revoked.
   * When true, adds an extra database lookup to verify the token hasn't been revoked.
   * Use this for high-security routes where immediate session invalidation is required.
   *
   * @default true
   * @see https://firebase.google.com/docs/auth/admin/manage-sessions
   */
  checkRevoked?: boolean;
}

const INVALID_IDENTITY_CODES = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/invalid-id-token",
  "auth/id-token-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);
const BEARER_CHALLENGE = "Bearer";
const TOKEN68_PATTERN = /^[A-Za-z0-9._~+/-]+=*$/;

function setBearerChallenge(reply: FastifyReply): void {
  reply.header("WWW-Authenticate", BEARER_CHALLENGE);
}

function rawAuthorizationValues(request: FastifyRequest): string[] {
  const values: string[] = [];
  const headers = request.raw.rawHeaders;
  for (let index = 0; index + 1 < headers.length; index += 2) {
    if (headers.at(index)?.toLowerCase() === "authorization") {
      const value = headers.at(index + 1);
      if (value !== undefined) values.push(value);
    }
  }
  return values;
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
    const { checkRevoked = true } = options;

    // Decorate request with user placeholder
    fastify.decorateRequest("user", null);

    // Authentication preHandler
    const authenticate = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const authorizationValues = rawAuthorizationValues(request);
      const authHeader = authorizationValues.length === 1 ? authorizationValues[0] : undefined;
      if (authHeader === undefined) {
        setBearerChallenge(reply);
        throw new PortableError("unauthorized");
      }

      const authorization = /^Bearer +([^\s]+)$/i.exec(authHeader);
      const token = authorization?.[1];
      if (!token || !TOKEN68_PATTERN.test(token)) {
        setBearerChallenge(reply);
        throw new PortableError("unauthorized");
      }

      try {
        const decodedToken = await fastify.firebaseAuth.verifyIdToken(token, checkRevoked);
        if (
          typeof decodedToken.uid !== "string" ||
          decodedToken.uid.length === 0 ||
          [...decodedToken.uid].length > 128
        ) {
          setBearerChallenge(reply);
          throw new PortableError("unauthorized");
        }
        request.user = decodedToken;
      } catch (error) {
        if (error instanceof PortableError) throw error;
        const firebaseError = error as { code?: string };
        const firebaseErrorCode = firebaseError.code ?? "unknown";
        if (INVALID_IDENTITY_CODES.has(firebaseErrorCode)) {
          request.log.warn({ firebase_error_code: firebaseErrorCode }, "Firebase token verification failed");
          setBearerChallenge(reply);
          throw new PortableError("unauthorized");
        }
        throw new PortableError("dependency_unavailable", { cause: error });
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
