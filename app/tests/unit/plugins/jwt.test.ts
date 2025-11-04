import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import jwtPlugin from "../../../src/plugins/jwt.js";

interface JwtPayload {
	userId?: number;
	role?: string;
	email?: string;
	name?: string;
	sub?: string;
	iss?: string;
	permissions?: string[];
	iat?: number;
	exp?: number;
	[key: string]: unknown;
}

describe("JWT Plugin", () => {
	let app: ReturnType<typeof Fastify>;

	beforeEach(async () => {
		// Set a test secret to avoid warnings
		process.env.JWT_SECRET = "test-secret-key";
		process.env.NODE_ENV = "test";
		app = Fastify();
		await app.register(jwtPlugin);
	});

	afterEach(async () => {
		await app.close();
		delete process.env.JWT_SECRET;
		delete process.env.NODE_ENV;
	});

	test("should sign a JWT token", async () => {
		const payload = { userId: 123, role: "admin" };
		const token = await app.jwt.sign(payload);

		expect(token).toBeDefined();
		expect(typeof token).toBe("string");
		expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
	});

	test("should verify a valid JWT token", async () => {
		const payload = { userId: 456, role: "user" };
		const token = await app.jwt.sign(payload);

		const decoded = (await app.jwt.verify(token)) as JwtPayload;

		expect(decoded).toBeDefined();
		expect(decoded.userId).toBe(456);
		expect(decoded.role).toBe("user");
		expect(decoded.iat).toBeDefined();
		expect(decoded.exp).toBeDefined();
	});

	test("should decode JWT token without verification", () => {
		const payload = { userId: 789, role: "moderator" };
		const token = app.jwt.sign(payload);

		const decoded = app.jwt.decode(token) as JwtPayload;

		expect(decoded).toBeDefined();
		expect(decoded.userId).toBe(789);
		expect(decoded.role).toBe("moderator");
	});

	test("should reject invalid JWT token", async () => {
		const invalidToken = "invalid.jwt.token";

		expect(() => app.jwt.verify(invalidToken)).toThrow();
	});

	test("should reject expired JWT token", async () => {
		const payload = { userId: 999, role: "admin" };
		// Sign with very short expiration
		const token = await app.jwt.sign(payload, { expiresIn: "1ms" });

		// Wait for token to expire
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(() => app.jwt.verify(token)).toThrow();
	});

	test("should provide authenticate decorator", async () => {
		expect(app.authenticate).toBeDefined();
		expect(typeof app.authenticate).toBe("function");
	});

	test("should protect routes with authenticate decorator - valid token", async () => {
		app.get(
			"/protected",
			{
				onRequest: [app.authenticate],
			},
			async (request: FastifyRequest) => ({ user: request.user }),
		);

		const token = await app.jwt.sign({ userId: 123, username: "test" });

		const response = await app.inject({
			method: "GET",
			url: "/protected",
			headers: {
				authorization: `Bearer ${token}`,
			},
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.payload);
		expect(body.user.userId).toBe(123);
		expect(body.user.username).toBe("test");
	});

	test("should protect routes with authenticate decorator - no token", async () => {
		app.get(
			"/protected-no-token",
			{
				onRequest: [app.authenticate],
			},
			async (request: FastifyRequest) => ({ user: request.user }),
		);

		const response = await app.inject({
			method: "GET",
			url: "/protected-no-token",
		});

		expect(response.statusCode).toBe(401);
		const errorBody = JSON.parse(response.payload);
		expect(errorBody.error.code).toBe("UNAUTHORIZED");
		expect(errorBody.error.message).toBe("Unauthorized");
	});

	test("should protect routes with authenticate decorator - invalid token", async () => {
		app.get(
			"/protected-invalid",
			{
				onRequest: [app.authenticate],
			},
			async (request: FastifyRequest) => ({ user: request.user }),
		);

		const response = await app.inject({
			method: "GET",
			url: "/protected-invalid",
			headers: {
				authorization: "Bearer invalid-token",
			},
		});

		expect(response.statusCode).toBe(401);
		const body = JSON.parse(response.payload);
		expect(body.error.code).toBe("UNAUTHORIZED");
	});

	test("should verify token from Authorization header", async () => {
		const payload = { userId: 222, role: "editor" };
		const token = await app.jwt.sign(payload);

		// Create a route that uses jwtVerify
		app.get("/test-auth", async (request: FastifyRequest) => {
			await request.jwtVerify();
			return { authenticated: true, user: request.user };
		});

		const response = await app.inject({
			method: "GET",
			url: "/test-auth",
			headers: {
				authorization: `Bearer ${token}`,
			},
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.authenticated).toBe(true);
		expect(body.user.userId).toBe(222);
	});

	test("should reject malformed Authorization header", async () => {
		// Create a route that requires JWT verification
		app.get("/protected", async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				await request.jwtVerify();
				return { success: true };
			} catch {
				reply.code(401);
				return { error: "Unauthorized" };
			}
		});

		const response = await app.inject({
			method: "GET",
			url: "/protected",
			headers: {
				authorization: "InvalidFormat",
			},
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({ error: "Unauthorized" });
	});

	test("should successfully verify valid token on protected route", async () => {
		const payload = { userId: 333, role: "admin" };
		const token = await app.jwt.sign(payload);

		// Create a route that requires JWT verification
		app.get("/protected-auth", async (request: FastifyRequest, reply: FastifyReply) => {
			try {
				await request.jwtVerify();
				return { success: true, user: request.user };
			} catch {
				reply.code(401);
				return { error: "Unauthorized" };
			}
		});

		const response = await app.inject({
			method: "GET",
			url: "/protected-auth",
			headers: {
				authorization: `Bearer ${token}`,
			},
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.success).toBe(true);
		expect(body.user.userId).toBe(333);
		expect(body.user.role).toBe("admin");
	});

	test("should handle different payload types", async () => {
		const payloads = [
			{ userId: 1, role: "admin", permissions: ["read", "write"] },
			{ email: "user@example.com", name: "Test User" },
			{ sub: "12345", iss: "test-issuer" },
		];

		for (const payload of payloads) {
			const token = await app.jwt.sign(payload);
			const decoded = (await app.jwt.verify(token)) as JwtPayload;

			for (const key of Object.keys(payload)) {
				expect(decoded[key]).toEqual(payload[key as keyof typeof payload]);
			}
		}
	});

	test("should warn in development when JWT_SECRET is not set", async () => {
		delete process.env.JWT_SECRET;
		delete process.env.NODE_ENV;

		const devApp = Fastify();
		const logs: string[] = [];

		// Capture log warnings
		devApp.log.warn = (msg: string) => {
			logs.push(msg);
		};

		await devApp.register(jwtPlugin);

		expect(logs.length).toBeGreaterThan(0);
		expect(logs[0]).toContain("JWT_SECRET not set");

		await devApp.close();
	});
});
