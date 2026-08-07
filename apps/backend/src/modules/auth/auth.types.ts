/**
 * auth Types
 *
 * Shared TypeScript types for the auth module.
 *
 * Responsibilities:
 * - Define DTO type aliases and interfaces.
 * - Keep request and response DTO shapes reusable.
 * - Export types shared across controllers, services, repositories, and routes.
 *
 * Do NOT:
 * - Put runtime logic here.
 * - Define validation schemas here.
 * - Duplicate types that belong in shared packages.
 */

import type { User } from "../../database/prisma/generated/client";
import type { UserRole } from "../../database/prisma/generated/enums";

export type AuthUser = Pick<
	User,
	| "id"
	| "firstName"
	| "lastName"
	| "email"
	| "role"
	| "emailVerified"
	| "verificationStatus"
	| "verificationSubmittedAt"
	| "profileCompleted"
	| "createdAt"
	| "updatedAt"
>;

export type UserWithPassword = AuthUser & {
	passwordHash: string | null;
	googleId?: string | null;
};

export type GoogleUserInfo = {
	sub: string;
	email: string;
	name?: string;
	given_name?: string;
	family_name?: string;
	email_verified?: boolean;
	picture?: string;
};

export type AccessTokenPayload = {
	sub: string;
	email: string;
	role: UserRole;
	tokenType: "access";
};

export type RefreshTokenRecord = {
	id: string;
	userId: string;
	tokenHash: string;
	deviceId: string;
	deviceName: string | null;
	lastUsedAt: Date;
	expiresAt: Date;
	revokedAt: Date | null;
	user: UserWithPassword;
};

export type AuthSession = {
	accessTokenPayload: AccessTokenPayload;
	refreshToken: string;
	refreshTokenExpiresAt: Date;
	user: AuthUser;
};

export type CreateUserInput = {
	firstName: string;
	lastName: string | null;
	email: string;
	passwordHash: string | null;
	googleId?: string | null;
	role: UserRole;
	emailVerified?: boolean;
	emailVerifiedAt?: Date | null;
	profileCompleted?: boolean;
};

export type CreateRefreshTokenInput = {
	userId: string;
	tokenHash: string;
	deviceId: string;
	deviceName?: string | null;
	expiresAt: Date;
};

export type EmailOtpRecord = {
	id: string;
	userId: string;
	otpHash: string;
	expiresAt: Date;
	consumedAt: Date | null;
	createdAt: Date;
};
