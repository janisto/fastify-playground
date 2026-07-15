import fp from "fastify-plugin";
import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";

const DEFAULT_FIREBASE_APP = "[DEFAULT]";

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
    const app = existingApp ?? initializeApp();

    if (ownsApp) {
      fastify.log.info("Firebase Admin SDK initialized with Application Default Credentials");
    } else {
      fastify.log.debug("Using existing default Firebase app instance");
    }

    fastify.decorate("firebaseAuth", getAuth(app));

    fastify.addHook("onClose", async () => {
      if (!ownsApp) return;
      await deleteApp(app);
      fastify.log.info("Firebase Admin SDK resources closed");
    });
  },
  {
    name: "firebase",
    fastify: "5.x",
  },
);
