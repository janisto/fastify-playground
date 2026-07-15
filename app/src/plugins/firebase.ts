import fp from "fastify-plugin";
import type { App } from "firebase-admin/app";
import { getApps, initializeApp } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";

declare module "fastify" {
  interface FastifyInstance {
    firebase: App;
    firebaseAuth: Auth;
    firestore: Firestore;
  }
}

/**
 * Firebase Admin SDK plugin for Fastify.
 *
 * This plugin initializes the Firebase Admin SDK and provides access to:
 * - `fastify.firebase` - The Firebase App instance
 * - `fastify.firebaseAuth` - Firebase Authentication service
 * - `fastify.firestore` - Cloud Firestore database service
 *
 * Credentials are loaded via Application Default Credentials (ADC):
 * - In production (Cloud Run, GCE): Automatically uses the service account
 * - In development: Uses GOOGLE_APPLICATION_CREDENTIALS env var or emulators
 *
 * Environment variables for emulators:
 * - FIRESTORE_EMULATOR_HOST - Firestore emulator (e.g., "localhost:8080")
 * - FIREBASE_AUTH_EMULATOR_HOST - Auth emulator (e.g., "localhost:9099")
 *
 * @see https://firebase.google.com/docs/admin/setup
 */
export default fp(
  async (fastify) => {
    let app: App;

    // Check if Firebase app is already initialized (prevents re-initialization in tests)
    const existingApp = getApps().at(0);
    if (existingApp) {
      app = existingApp;
      fastify.log.debug("Using existing Firebase app instance");
    } else {
      app = initializeApp();
      fastify.log.info("Firebase Admin SDK initialized with Application Default Credentials");
    }

    const auth = getAuth(app);
    const firestore = getFirestore(app);

    // Decorate Fastify instance
    fastify.decorate("firebase", app);
    fastify.decorate("firebaseAuth", auth);
    fastify.decorate("firestore", firestore);

    // Cleanup on close
    fastify.addHook("onClose", async (instance) => {
      instance.log.info("Closing Firestore connection...");
      await firestore.terminate();
    });
  },
  {
    name: "firebase",
    fastify: "5.x",
  },
);
