import fp from "fastify-plugin";
import type { App, ServiceAccount } from "firebase-admin/app";
import { cert, getApps, initializeApp } from "firebase-admin/app";
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
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
      fastify.log.debug("Using existing Firebase app instance");
    } else {
      // Initialize with ADC (Application Default Credentials)
      // In Cloud Run / GCE, this uses the service account automatically
      // Locally, set GOOGLE_APPLICATION_CREDENTIALS or use emulators
      /* v8 ignore start -- @preserve */
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (serviceAccountPath) {
        // Dynamic import for service account file
        const { default: serviceAccount } = (await import(serviceAccountPath, { with: { type: "json" } })) as { default: ServiceAccount };
        app = initializeApp({
          credential: cert(serviceAccount),
        });
        fastify.log.info("Firebase Admin SDK initialized with service account");
      } else {
        // Use ADC (works in Cloud Run, GCE, or with emulators)
        app = initializeApp();
        fastify.log.info("Firebase Admin SDK initialized with Application Default Credentials");
      }
      /* v8 ignore stop -- @preserve */
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
