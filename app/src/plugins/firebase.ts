import { randomUUID } from "node:crypto";
import fp from "fastify-plugin";
import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";

const DEFAULT_FIREBASE_APP = "[DEFAULT]";
const OWNED_FIREBASE_APP_PREFIX = "fastify-playground-";

declare module "fastify" {
  interface FastifyInstance {
    firebaseAuth: Auth;
  }
}

/** Provides a Firebase Auth client backed by Application Default Credentials. */
export default fp(
  async (fastify) => {
    const existingApp = getApps().find((candidate) => candidate.name === DEFAULT_FIREBASE_APP);
    const ownsApp = existingApp === undefined;
    const app = existingApp ?? initializeApp(undefined, `${OWNED_FIREBASE_APP_PREFIX}${randomUUID()}`);

    if (ownsApp) {
      fastify.log.info({ firebase_app_name: app.name }, "Firebase Admin SDK initialized");
    } else {
      fastify.log.debug("Using existing default Firebase app instance");
    }

    fastify.addHook("onClose", async () => {
      if (!ownsApp) return;
      await deleteApp(app);
      fastify.log.info("Firebase Admin SDK resources closed");
    });

    fastify.decorate("firebaseAuth", getAuth(app));
  },
  {
    name: "firebase",
    fastify: "5.x",
  },
);
