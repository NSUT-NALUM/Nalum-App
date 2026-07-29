import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("Auth routes", () => {
	let app: FastifyInstance;

	beforeAll(async () => {
		process.env.DATABASE_URL = testDatabaseUrl;
		process.env.JWT_SECRET =
			process.env.JWT_SECRET ?? "test-secret-with-at-least-32-characters";

		const { buildApp } = await import("../../app");
		app = await buildApp({ logger: false });
		await app.ready();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("returns validation errors before the controller runs", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/api/auth/login",
			payload: {
				email: "not-an-email",
				password: "short",
			},
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toMatchObject({
			success: false,
			error: {
				code: "VALIDATION_ERROR",
			},
		});
	});

	it("registers and logs in a user", async () => {
		const email = `auth-${Date.now()}@nsut.ac.in`;

		const registerResponse = await app.inject({
			method: "POST",
			url: "/api/auth/register",
			payload: {
				firstName: "Integration",
				lastName: "User",
				email,
				password: "password123",
				role: "STUDENT",
			},
		});

		expect(registerResponse.statusCode).toBe(201);
		expect(registerResponse.json().data.accessToken).toEqual(
			expect.any(String),
		);
		expect(
			registerResponse.cookies.some((cookie) => cookie.name === "refreshToken"),
		).toBe(true);

		const loginResponse = await app.inject({
			method: "POST",
			url: "/api/auth/login",
			payload: {
				email,
				password: "password123",
			},
		});

		expect(loginResponse.statusCode).toBe(200);
		expect(loginResponse.json().data.accessToken).toEqual(expect.any(String));
	});

	it("requires a refresh cookie", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/api/auth/refresh",
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toMatchObject({
			success: false,
			error: {
				code: "AUTH_REFRESH_TOKEN_REQUIRED",
			},
		});
	});
});
