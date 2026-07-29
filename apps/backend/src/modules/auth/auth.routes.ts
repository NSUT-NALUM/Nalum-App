/**
 * auth Routes
 *
 * Responsibilities:
 * - Register endpoints.
 * - Attach middleware.
 * - Attach schemas.
 */

import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod/v4";
import { authenticateUser } from "../../middlewares/auth.middleware";
import oauthPlugin from "../../plugins/oauth.plugin";
import { EmailService } from "../email";
import { AuthController } from "./auth.controller";
import AuthRepository from "./auth.repository";
import * as schema from "./auth.schema";
import { AuthService } from "./auth.service";

const authRoutes: FastifyPluginAsync = async (fastify) => {
	const repository = new AuthRepository(fastify.prisma);
	const emailService = new EmailService();
	const service = new AuthService(repository, emailService);
	const controller = new AuthController(service);
	const app = fastify.withTypeProvider<ZodTypeProvider>();

	await fastify.register(oauthPlugin);

	app.post(
		"/register",
		{
			schema: {
				summary: "Register a local account",
				description:
					"Creates a password-based account and returns access and refresh tokens.",
				tags: ["Auth"],
				body: schema.registerSchemaRequest,
				response: {
					201: schema.authResponseSchema,
				},
			},
		},
		controller.register,
	);

	app.post(
		"/login",
		{
			schema: {
				summary: "Log in with email and password",
				description:
					"Authenticates an existing password-based account and issues a new session.",
				tags: ["Auth"],
				body: schema.loginSchemaRequest,
				response: {
					200: schema.authResponseSchema,
				},
			},
		},
		controller.login,
	);

	app.post(
		"/refresh",
		{
			schema: {
				summary: "Refresh the access token",
				description:
					"Uses the refresh-token cookie to rotate the session and mint a new access token.",
				tags: ["Auth"],
				response: {
					200: schema.authResponseSchema,
				},
			},
		},
		controller.refresh,
	);

	app.post(
		"/logout",
		{
			schema: {
				summary: "Log out the current session",
				description:
					"Revokes the refresh token cookie and ends the current session.",
				tags: ["Auth"],
				response: {
					200: schema.logoutResponseSchema,
				},
			},
		},
		controller.logout,
	);

	app.get(
		"/sessions",
		{
			preHandler: authenticateUser,
			schema: { tags: ["Auth"], security: [{ bearerAuth: [] }] },
		},
		controller.listSessions,
	);

	app.delete(
		"/sessions/:sessionId",
		{
			preHandler: authenticateUser,
			schema: {
				tags: ["Auth"],
				security: [{ bearerAuth: [] }],
				params: schema.sessionParamsSchema,
			},
		},
		controller.revokeSession,
	);

	app.post(
		"/email-verification/send",
		{
			preHandler: authenticateUser,
			schema: {
				summary: "Send email verification OTP",
				description:
					"Sends a six digit OTP to the current user's email address.",
				tags: ["Auth"],
				security: [{ bearerAuth: [] }],
				response: {
					200: schema.messageResponseSchema,
				},
			},
		},
		controller.sendEmailVerificationOtp,
	);

	app.post(
		"/email-verification/verify",
		{
			preHandler: authenticateUser,
			schema: {
				summary: "Verify email OTP",
				description:
					"Verifies the current user's email address using the OTP sent by email.",
				tags: ["Auth"],
				security: [{ bearerAuth: [] }],
				body: schema.verifyEmailOtpSchemaRequest,
				response: {
					200: schema.messageResponseSchema,
				},
			},
		},
		controller.verifyEmailOtp,
	);

	app.get(
		"/google/callback",
		{
			schema: {
				summary: "Complete Google sign-in",
				description:
					"Handles the Google OAuth callback, creates a cookie-backed session, and redirects to the web app.",
				tags: ["Auth", "Google"],
				response: {
					302: z.string().describe("Redirect response to the web app."),
				},
			},
		},
		controller.googleCallback,
	);
};

export default authRoutes;
