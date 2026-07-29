import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession, GoogleUserInfo } from "./auth.types";

vi.mock("../../config/env.config", () => ({
	env: {
		NODE_ENV: "test",
		WEB_APP_URL: "http://localhost:8081",
	},
}));

import { AuthController } from "./auth.controller";
import type { AuthService } from "./auth.service";

const googleProfile: GoogleUserInfo = {
	sub: "google-subject",
	email: "alumni@example.com",
	given_name: "Test",
	family_name: "Alumni",
};

const session: AuthSession = {
	accessTokenPayload: {
		sub: "018f6b4f-4580-7000-8000-000000000001",
		email: googleProfile.email,
		role: "ALUMNI",
		tokenType: "access",
	},
	refreshToken: "refresh-token",
	refreshTokenExpiresAt: new Date("2026-07-25T12:00:00.000Z"),
	user: {
		id: "018f6b4f-4580-7000-8000-000000000001",
		firstName: "Test",
		lastName: "Alumni",
		email: googleProfile.email,
		role: "ALUMNI",
		emailVerified: true,
		verificationStatus: null,
		verificationSubmittedAt: null,
		profileCompleted: false,
		createdAt: new Date("2026-07-24T12:00:00.000Z"),
		updatedAt: new Date("2026-07-24T12:00:00.000Z"),
	},
};

describe("AuthController Google callback", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("sets the session cookies and redirects to the frontend callback", async () => {
		const loginWithGoogle = vi.fn().mockResolvedValue(session);
		const getAccessTokenFromAuthorizationCodeFlow = vi.fn().mockResolvedValue({
			token: { access_token: "google-access-token" },
		});
		const setCookie = vi.fn();
		const redirect = vi.fn();

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify(googleProfile), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		const controller = new AuthController({
			loginWithGoogle,
		} as unknown as AuthService);
		const request = {
			cookies: {},
			headers: { "user-agent": "Vitest" },
			server: {
				googleOAuth2: { getAccessTokenFromAuthorizationCodeFlow },
			},
		} as unknown as FastifyRequest;
		const reply = { setCookie, redirect } as unknown as FastifyReply;

		await controller.googleCallback(request, reply);

		expect(loginWithGoogle).toHaveBeenCalledWith(
			googleProfile,
			expect.objectContaining({ name: "Vitest" }),
		);
		const device = loginWithGoogle.mock.calls[0]?.[1];
		expect(setCookie).toHaveBeenCalledWith(
			"refreshToken",
			session.refreshToken,
			expect.objectContaining({
				httpOnly: true,
				path: "/api/auth",
			}),
		);
		expect(setCookie).toHaveBeenCalledWith(
			"deviceId",
			device.id,
			expect.objectContaining({
				httpOnly: true,
				path: "/",
			}),
		);
		expect(redirect).toHaveBeenCalledWith(
			"http://localhost:8081/auth/callback",
			302,
		);
	});
});
