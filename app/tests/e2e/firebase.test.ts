import { applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { firebaseOptions } from "../../src/plugins/firebase.js";

describe("real local Firebase authentication and profiles", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("verifies emulator identities and performs isolated profile CRUD over HTTP without ADC", async () => {
    const options = firebaseOptions();
    if (options?.projectId !== "demo-test") throw new Error("Run just test-e2e with the demo-test emulators");
    vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "/nonexistent-fastify-emulator-credentials.json");
    const adc = vi.spyOn(applicationDefault(), "getAccessToken").mockRejectedValue(new Error("ADC must not be used"));
    const app = await buildApp({ loggerLevel: "silent" });
    const principals: string[] = [];
    const authHost = process.env["FIREBASE_AUTH_EMULATOR_HOST"];
    const createToken = async () => {
      const response = await fetch(
        `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-test`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ returnSecureToken: true }),
          signal: AbortSignal.timeout(3000),
        },
      );
      expect(response.status).toBe(200);
      const identity = (await response.json()) as { idToken: string; localId: string };
      principals.push(identity.localId);
      return { authorization: `Bearer ${identity.idToken}`, "content-type": "application/json" };
    };
    try {
      const origin = await app.listen({ host: "127.0.0.1", port: 0 });
      const first = await createToken();
      const second = await createToken();
      const identity = await fetch(`${origin}/v1/auth/me`, { headers: first });
      expect(identity.status).toBe(200);
      expect(await identity.json()).toEqual({ userId: principals.at(0) });
      const body = {
        firstName: "Casey",
        lastName: "Morgan",
        contactEmail: "Casey@example.test",
        phoneNumber: "+12025550123",
        marketingOptIn: false,
        termsAccepted: true,
      };
      const created = await fetch(`${origin}/v1/profile`, {
        method: "POST",
        headers: first,
        body: JSON.stringify(body),
      });
      expect(created.status).toBe(201);
      expect(created.headers.get("location")).toBe("/v1/profile");
      const createdProfile: unknown = await created.json();
      expect(createdProfile).toMatchObject({ ...body, id: principals.at(0) });
      const isolated = await fetch(`${origin}/v1/profile`, { headers: second });
      expect(isolated.status).toBe(404);
      const read = await fetch(`${origin}/v1/profile`, { headers: first });
      expect(await read.json()).toEqual(createdProfile);
      const duplicate = await fetch(`${origin}/v1/profile`, {
        method: "POST",
        headers: first,
        body: JSON.stringify(body),
      });
      expect(duplicate.status).toBe(409);
      const updated = await fetch(`${origin}/v1/profile`, {
        method: "PATCH",
        headers: first,
        body: JSON.stringify({ marketingOptIn: true }),
      });
      expect(updated.status).toBe(200);
      const updatedProfile: unknown = await updated.json();
      expect(updatedProfile).toMatchObject({ ...body, marketingOptIn: true });
      const unchanged = await fetch(`${origin}/v1/profile`, {
        method: "PATCH",
        headers: first,
        body: JSON.stringify({ marketingOptIn: true }),
      });
      expect(await unchanged.json()).toEqual(updatedProfile);
      const deleted = await fetch(`${origin}/v1/profile`, { method: "DELETE", headers: first });
      expect(deleted.status).toBe(204);
      expect(await deleted.text()).toBe("");
      const absent = await fetch(`${origin}/v1/profile`, { headers: first });
      expect(absent.status).toBe(404);
      expect(adc).not.toHaveBeenCalled();
    } finally {
      try {
        await Promise.all(
          principals.map(async (uid) => {
            const records = await getFirestore(app.firebaseAuth.app)
              .collection("profiles")
              .where("id", "==", uid)
              .get();
            await Promise.all(records.docs.map(async (record) => record.ref.delete()));
            await app.firebaseAuth.deleteUser(uid);
          }),
        );
      } finally {
        await app.close();
        adc.mockRestore();
      }
    }
  });
});
