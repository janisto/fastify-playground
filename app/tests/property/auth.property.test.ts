import { fc, test } from "@fast-check/vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock } from "../mocks/firebase.js";
import { propertyParameters } from "./config.js";

const mockApp = createFirebaseAppMock();
const mockAuth = createFirebaseAuthMock();

vi.mock("firebase-admin/app", () => ({
  deleteApp: vi.fn().mockResolvedValue(undefined),
  getApps: vi.fn(() => [mockApp]),
  initializeApp: vi.fn(() => mockApp),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => mockAuth) }));

let app: FastifyInstance | undefined;

async function build(): Promise<FastifyInstance> {
  const [{ default: sensible }, { default: firebase }, { default: auth }] = await Promise.all([
    import("../../src/plugins/sensible.js"),
    import("../../src/plugins/firebase.js"),
    import("../../src/plugins/auth.js"),
  ]);
  const instance = Fastify({ logger: false });
  instance.register(sensible);
  instance.register(firebase);
  instance.register(auth);
  instance.register(async (scope) => {
    scope.get("/protected", { preHandler: [scope.authenticate] }, async (request) => ({ uid: request.user?.uid }));
  });
  await instance.ready();
  return instance;
}

function currentApp(): FastifyInstance {
  if (app === undefined) throw new Error("Fastify property fixture is not ready");
  return app;
}

beforeEach(async () => {
  vi.clearAllMocks();
  app = await build();
});

afterEach(async () => {
  const current = app;
  app = undefined;
  await current?.close();
});

const bearerScheme = fc
  .tuple(
    ...[..."Bearer"].map((character) => fc.boolean().map((upper) => (upper ? character.toUpperCase() : character))),
  )
  .map((characters) => characters.join(""));
const token = fc.stringMatching(/^[A-Za-z0-9._~+/-]{1,64}=*$/);

test.prop([bearerScheme, token, fc.integer({ min: 1, max: 8 })], propertyParameters)(
  "verifies only the token from an exact Bearer header",
  async (scheme, value, spaces) => {
    mockAuth.verifyIdToken.mockResolvedValueOnce({ uid: "property-user" });

    const response = await Promise.resolve(
      currentApp().inject({
        method: "GET",
        url: "/protected",
        headers: { authorization: `${scheme}${" ".repeat(spaces)}${value}` },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ uid: "property-user" });
    expect(mockAuth.verifyIdToken).toHaveBeenCalledTimes(1);
    expect(mockAuth.verifyIdToken).toHaveBeenCalledWith(value, true);
  },
);

const invalidAuthorization = token.chain((value) =>
  fc.constantFrom(
    `Basic ${value}`,
    `Bearer\t${value}`,
    ` Bearer ${value}`,
    `Bearer ${value} extra`,
    `Bearer ${value}\tmore`,
  ),
);

test.prop([invalidAuthorization], propertyParameters)(
  "rejects malformed bearer syntax before Firebase",
  async (authorization) => {
    const response = await Promise.resolve(
      currentApp().inject({
        method: "GET",
        url: "/protected",
        headers: { authorization },
      }),
    );

    expect(response.statusCode).toBe(401);
    expect(mockAuth.verifyIdToken).not.toHaveBeenCalled();
  },
);
