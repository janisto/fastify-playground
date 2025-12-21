import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirebaseAppMock, createFirebaseAuthMock, createFirestoreMock } from "../../mocks/firebase.js";

// Mock firebase-admin modules
const mockApp = createFirebaseAppMock();
const mockAuth = createFirebaseAuthMock();
const mockFirestore = createFirestoreMock();

vi.mock("firebase-admin/app", () => ({
	getApps: vi.fn(() => [mockApp]),
	initializeApp: vi.fn(() => mockApp),
	cert: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
	getAuth: vi.fn(() => mockAuth),
}));

vi.mock("firebase-admin/firestore", () => ({
	getFirestore: vi.fn(() => mockFirestore),
}));

describe("Firebase Plugin", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(async () => {
		vi.resetModules();
	});

	describe("Plugin Registration", () => {
		it("should register firebase decorator", async () => {
			const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
			const fastify = Fastify();
			await fastify.register(firebasePlugin);
			await fastify.ready();

			expect(fastify.firebase).toBeDefined();
			expect(fastify.firebase).toBe(mockApp);

			await fastify.close();
		});

		it("should register firebaseAuth decorator", async () => {
			const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
			const fastify = Fastify();
			await fastify.register(firebasePlugin);
			await fastify.ready();

			expect(fastify.firebaseAuth).toBeDefined();
			expect(fastify.firebaseAuth).toBe(mockAuth);

			await fastify.close();
		});

		it("should register firestore decorator", async () => {
			const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
			const fastify = Fastify();
			await fastify.register(firebasePlugin);
			await fastify.ready();

			expect(fastify.firestore).toBeDefined();
			expect(fastify.firestore).toBe(mockFirestore);

			await fastify.close();
		});
	});

	describe("Cleanup", () => {
		it("should terminate firestore on close", async () => {
			const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");
			const fastify = Fastify();
			await fastify.register(firebasePlugin);
			await fastify.ready();

			await fastify.close();

			expect(mockFirestore.terminate).toHaveBeenCalledOnce();
		});
	});

	describe("Existing App Detection", () => {
		it("should reuse existing Firebase app when already initialized", async () => {
			const { getApps } = await import("firebase-admin/app");
			const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");

			const fastify = Fastify();
			await fastify.register(firebasePlugin);
			await fastify.ready();

			expect(getApps).toHaveBeenCalled();
			expect(fastify.firebase).toBe(mockApp);

			await fastify.close();
		});

		it("should initialize new Firebase app when no existing apps", async () => {
			const { getApps, initializeApp } = await import("firebase-admin/app");
			vi.mocked(getApps).mockReturnValueOnce([]);

			const { default: firebasePlugin } = await import("../../../src/plugins/firebase.js");

			const fastify = Fastify();
			await fastify.register(firebasePlugin);
			await fastify.ready();

			expect(getApps).toHaveBeenCalled();
			expect(initializeApp).toHaveBeenCalled();
			expect(fastify.firebase).toBe(mockApp);

			await fastify.close();
		});
	});
});
