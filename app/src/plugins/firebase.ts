import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import fp from "fastify-plugin";
import { type AppOptions, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import { getAuth } from "firebase-admin/auth";

const DEFAULT_FIREBASE_APP = "[DEFAULT]";
const OWNED_FIREBASE_APP_PREFIX = "fastify-playground-";

declare module "fastify" {
  interface FastifyInstance {
    firebaseAuth: Auth;
  }
}

function isLoopbackEndpoint(value: string): boolean {
  if (/[\s/@?#\\]/.test(value)) return false;
  const match = /^(localhost|127\.[0-9]+\.[0-9]+\.[0-9]+|\[::1\]):([0-9]+)$/.exec(value);
  const host = match?.[1];
  const port = Number(match?.[2]);
  return (
    host !== undefined && port >= 1 && port <= 65_535 && (host === "localhost" || host === "[::1]" || isIP(host) === 4)
  );
}

export function firebaseOptions(): AppOptions | undefined {
  const auth = process.env["FIREBASE_AUTH_EMULATOR_HOST"];
  const firestore = process.env["FIRESTORE_EMULATOR_HOST"];
  if (auth === undefined && firestore === undefined) return undefined;
  const projectId = process.env["FIREBASE_PROJECT_ID"];
  if (
    process.env["NODE_ENV"] === "production" ||
    !auth ||
    !firestore ||
    !isLoopbackEndpoint(auth) ||
    !isLoopbackEndpoint(firestore) ||
    !projectId?.startsWith("demo-")
  ) {
    throw new Error(
      "Firebase emulators require development/test mode, paired loopback endpoints with ports, and a demo- project ID",
    );
  }
  return { projectId };
}

/** Uses native local emulators or the SDK's hosted Application Default Credentials. */
export default fp(
  async (fastify) => {
    const options = firebaseOptions();
    const existingApp = getApps().find((candidate) => candidate.name === DEFAULT_FIREBASE_APP);
    if (options !== undefined && existingApp !== undefined && existingApp.options.projectId !== options.projectId) {
      throw new Error("The existing Firebase app must use the configured demo project");
    }
    const ownsApp = existingApp === undefined;
    const app = existingApp ?? initializeApp(options, `${OWNED_FIREBASE_APP_PREFIX}${randomUUID()}`);

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
