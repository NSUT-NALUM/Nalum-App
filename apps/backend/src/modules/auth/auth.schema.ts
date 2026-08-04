/**
 * auth Schemas
 *
 * Define request and response schemas using Zod.
 */

import { z } from "zod/v4";

const registerSchemaRequest = z
	.object({
		role: z
			.enum(["STUDENT", "ALUMNI", "PROFESSOR", "VISITOR"])
			.describe("Account role to create.")
			.meta({ examples: ["STUDENT"] }),
		firstName: z
			.string()
			.min(1, "First name is required")
			.describe("First name."),
		lastName: z.string().min(1, "Last name is required").describe("Last name."),
		email: z.email().describe("Email address used for the account."),
		password: z
			.string()
			.min(6, "Password must be at least 6 characters long")
			.describe("Password for the account."),
	})
	.describe("Request body for creating a local account.")
	.meta({
		examples: [
			{
				role: "STUDENT",
				firstName: "Aarav",
				lastName: "Sharma",
				email: "aarav@nsut.ac.in",
				password: "password123",
			},
		],
	});

const loginSchemaRequest = z
	.object({
		email: z.email().describe("Email address for the existing account."),
		password: z
			.string()
			.min(6, "Password must be at least 6 characters long")
			.describe("Password for the account."),
	})
	.describe("Request body for password login.")
	.meta({
		examples: [
			{
				email: "aarav@nsut.ac.in",
				password: "password123",
			},
		],
	});

const userResponseSchema = z
	.object({
		id: z.string().describe("Unique user id."),
		firstName: z.string().describe("First name."),
		lastName: z.string().describe("Last name."),
		email: z.email().describe("Email address."),
		role: z
			.enum(["STUDENT", "ALUMNI", "ADMIN", "PROFESSOR", "VISITOR"])
			.describe("User role."),
		emailVerified: z.boolean().describe("Whether the email has been verified."),
		verificationStatus: z
			.enum(["PENDING", "VERIFIED", "REJECTED"])
			.nullable()
			.describe("Alumni application status."),
		verificationSubmittedAt: z
			.date()
			.nullable()
			.describe("Most recent alumni application submission time."),
		profileCompleted: z.boolean().describe("Whether the profile is complete."),
		createdAt: z.date().describe("Account creation time."),
		updatedAt: z.date().describe("Last update time."),
	})
	.describe("Authenticated user payload.")
	.meta({
		examples: [
			{
				id: "usr_123",
				firstName: "Aarav",
				lastName: "Sharma",
				email: "aarav@nsut.ac.in",
				role: "STUDENT",
				emailVerified: true,
				profileCompleted: false,
				createdAt: "2026-07-11T00:00:00.000Z",
				updatedAt: "2026-07-11T00:00:00.000Z",
			},
		],
	});

const authDataSchema = z
	.object({
		accessToken: z.string().describe("JWT access token."),
		user: userResponseSchema,
	})
	.describe("Authentication response payload.")
	.meta({
		examples: [
			{
				accessToken: "eyJhbGciOi...",
				user: {
					id: "usr_123",
					firstName: "Aarav",
					lastName: "Sharma",
					email: "aarav@nsut.ac.in",
					role: "STUDENT",
					emailVerified: true,
					profileCompleted: false,
					createdAt: "2026-07-11T00:00:00.000Z",
					updatedAt: "2026-07-11T00:00:00.000Z",
				},
			},
		],
	});

const authResponseSchema = z
	.object({
		success: z
			.literal(true)
			.describe("Always true for successful authentication responses."),
		message: z.string().describe("Human-readable success message."),
		data: authDataSchema,
	})
	.describe("Standard authentication response envelope.")
	.meta({
		examples: [
			{
				success: true,
				message: "Logged in successfully",
				data: {
					accessToken: "eyJhbGciOi...",
					user: {
						id: "usr_123",
						firstName: "Aarav",
						lastName: "Sharma",
						email: "aarav@nsut.ac.in",
						role: "STUDENT",
						emailVerified: true,
						profileCompleted: false,
						createdAt: "2026-07-11T00:00:00.000Z",
						updatedAt: "2026-07-11T00:00:00.000Z",
					},
				},
			},
		],
	});

const logoutResponseSchema = z
	.object({
		success: z
			.literal(true)
			.describe("Always true for successful logout responses."),
		message: z.string().describe("Human-readable success message."),
		data: z.null().describe("No payload is returned."),
	})
	.describe("Logout response envelope.")
	.meta({
		examples: [
			{
				success: true,
				message: "Logged out successfully",
				data: null,
			},
		],
	});

const verifyEmailOtpSchemaRequest = z.object({
	otp: z
		.string()
		.regex(/^\d{6}$/, "OTP must be a 6 digit code")
		.describe("Six digit email verification OTP."),
});

const messageResponseSchema = z.object({
	success: z.literal(true).describe("Indicates successful execution."),
	message: z.string().describe("Human-readable response message."),
	data: z.null().describe("No payload is returned."),
});

const sessionParamsSchema = z.object({
	sessionId: z.uuid(),
});

const googleSignupQuerySchema = z.object({
	role: z.enum(["STUDENT", "ALUMNI", "PROFESSOR", "VISITOR"]),
});

export {
	authDataSchema,
	authResponseSchema,
	googleSignupQuerySchema,
	loginSchemaRequest,
	logoutResponseSchema,
	messageResponseSchema,
	registerSchemaRequest,
	sessionParamsSchema,
	userResponseSchema,
	verifyEmailOtpSchemaRequest,
};

export type RegisterBody = z.infer<typeof registerSchemaRequest>;
export type LoginBody = z.infer<typeof loginSchemaRequest>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type AuthData = z.infer<typeof authDataSchema>;
export type AuthResponseSchema = z.infer<typeof authResponseSchema>;
export type SessionParams = z.infer<typeof sessionParamsSchema>;
export type VerifyEmailOtpBody = z.infer<typeof verifyEmailOtpSchemaRequest>;
export type GoogleSignupQuery = z.infer<typeof googleSignupQuerySchema>;
