/**
 * auth Service
 *
 * Responsibilities:
 * - Business logic.
 * - Authorization.
 * - Coordinate repositories.
 *
 * Do NOT:
 * - Access req/res.
 * - Return HTTP responses.
 * - Query the database directly.
 */
import { createHash, randomBytes, randomInt } from "node:crypto";
import argon2 from "argon2";
import type { IEmailService } from "../email";
import { REFRESH_TOKEN_TTL_DAYS } from "./auth.constants";
import {
	EmailAlreadyExistsError,
	EmailAlreadyVerifiedError,
	EmailOtpRateLimitedError,
	GoogleAccountNotRegisteredError,
	InvalidCredentialsError,
	InvalidEmailError,
	InvalidEmailOtpError,
	InvalidRefreshTokenError,
	MissingRefreshTokenError,
	UserBannedError,
} from "./auth.errors";
import type { LoginBody, RegisterBody } from "./auth.schema";
import type {
	AccessTokenPayload,
	AuthSession,
	AuthUser,
	CreateRefreshTokenInput,
	EmailOtpRecord,
	GoogleUserInfo,
	RefreshTokenRecord,
	UserWithPassword,
} from "./auth.types";

export class AuthService {
	constructor(
		private readonly repository: AuthRepositoryContract,
		private readonly emailService: IEmailService,
	) {}

	async register(
		input: RegisterBody,
		device: AuthDevice = DEFAULT_AUTH_DEVICE,
	): Promise<AuthSession> {
		if (!input.email.endsWith("@nsut.ac.in") && input.role === "STUDENT") {
			throw new InvalidEmailError();
		}
		const existingUser = await this.repository.findUserByEmail(input.email);

		if (existingUser) {
			throw new EmailAlreadyExistsError();
		}

		const passwordHash = await this.hashPassword(input.password);
		const user = await this.repository.createUser({
			firstName: input.firstName,
			lastName: input.lastName,
			email: input.email,
			passwordHash,
			role: input.role,
			profileCompleted: input.role === "VISITOR",
		});

		await this.trySendInitialEmailVerificationOtp(user);
		return this.createSession(user, device);
	}

	async login(
		input: LoginBody,
		device: AuthDevice = DEFAULT_AUTH_DEVICE,
	): Promise<AuthSession> {
		const user = await this.repository.findUserByEmail(input.email);

		if (!user?.passwordHash) {
			throw new InvalidCredentialsError();
		}

		const passwordMatches = await this.verifyPassword(
			input.password,
			user.passwordHash,
		);

		if (!passwordMatches) {
			throw new InvalidCredentialsError();
		}
		if (this.isLegacyBcryptHash(user.passwordHash)) {
			await this.repository.updatePasswordHash(
				user.id,
				await this.hashPassword(input.password),
			);
		}
		await this.assertNotBanned(user.id);
		return this.createSession(user, device);
	}

	async loginWithGoogle(
		profile: GoogleUserInfo,
		device: AuthDevice = DEFAULT_AUTH_DEVICE,
		signupRole?: RegisterBody["role"],
	): Promise<AuthSession> {
		if (profile.email_verified === false) {
			throw new InvalidEmailError();
		}
		const userByGoogleId = await this.repository.findUserByGoogleId(
			profile.sub,
		);

		if (userByGoogleId) {
			await this.assertNotBanned(userByGoogleId.id);
			return this.createSession(userByGoogleId, device);
		}

		const userByEmail = await this.repository.findUserByEmail(profile.email);

		if (userByEmail) {
			const linkedUser = await this.repository.updateUserGoogleId(
				userByEmail.id,
				profile.sub,
			);

			await this.assertNotBanned(linkedUser.id);
			return this.createSession(linkedUser, device);
		}
		if (!signupRole) {
			throw new GoogleAccountNotRegisteredError();
		}
		if (!profile.email.endsWith("@nsut.ac.in") && signupRole === "STUDENT") {
			throw new InvalidEmailError();
		}
		const role = signupRole;
		const user = await this.repository.createUser({
			firstName: this.getGoogleFirstName(profile),
			lastName: this.getGoogleLastName(profile),
			email: profile.email,
			passwordHash: null,
			googleId: profile.sub,
			role,
			emailVerified: true,
			emailVerifiedAt: new Date(),
			profileCompleted: role === "VISITOR",
		});

		return this.createSession(user, device);
	}

	async sendEmailVerificationOtp(user: AuthUser) {
		if (user.emailVerified) {
			throw new EmailAlreadyVerifiedError();
		}

		const latestOtp = await this.repository.findLatestEmailOtp(user.id);
		const retryAt = latestOtp ? latestOtp.createdAt.getTime() + 60_000 : 0;
		if (retryAt > Date.now()) {
			throw new EmailOtpRateLimitedError(
				Math.ceil((retryAt - Date.now()) / 1000),
			);
		}

		const otp = this.generateEmailOtp();
		const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

		await this.repository.createEmailOtp({
			userId: user.id,
			otpHash: this.hashEmailOtp(otp),
			expiresAt,
		});

		await this.emailService.sendEmailVerificationOtp({
			to: user.email,
			firstName: user.firstName,
			otp,
		});
	}

	private async trySendInitialEmailVerificationOtp(user: AuthUser) {
		try {
			await this.sendEmailVerificationOtp(user);
		} catch {
			const latestOtp = await this.repository.findLatestEmailOtp(user.id);
			if (latestOtp) await this.repository.consumeEmailOtp(latestOtp.id);
		}
	}

	private async assertNotBanned(userId: string) {
		const ban = await this.repository.findActiveBan(userId);
		if (ban) throw new UserBannedError(ban);
	}

	async verifyEmailOtp(user: AuthUser, otp: string) {
		if (user.emailVerified) {
			throw new EmailAlreadyVerifiedError();
		}

		const emailOtp = await this.repository.findLatestEmailOtp(user.id);

		if (!emailOtp || !this.isUsableEmailOtp(emailOtp, otp)) {
			throw new InvalidEmailOtpError();
		}

		await this.repository.consumeEmailOtp(emailOtp.id);
		await this.repository.updateUserEmailVerified(user.id);
	}

	async refresh(
		rawRefreshToken: string | undefined,
		device: AuthDevice = DEFAULT_AUTH_DEVICE,
	): Promise<AuthSession> {
		if (!rawRefreshToken) {
			throw new MissingRefreshTokenError();
		}

		const currentToken = await this.repository.findRefreshTokenByHash(
			this.hashRefreshToken(rawRefreshToken),
		);

		if (!this.isUsableRefreshToken(currentToken)) {
			throw new InvalidRefreshTokenError();
		}
		await this.assertNotBanned(currentToken.userId);

		const nextRefreshToken = this.generateRefreshToken();
		const nextRefreshTokenExpiresAt = this.getRefreshTokenExpiry();

		await this.repository.rotateRefreshToken(currentToken.id, {
			userId: currentToken.userId,
			tokenHash: this.hashRefreshToken(nextRefreshToken),
			deviceId: device.id,
			deviceName: device.name,
			expiresAt: nextRefreshTokenExpiresAt,
		});

		return {
			accessTokenPayload: this.createAccessTokenPayload(currentToken.user),
			refreshToken: nextRefreshToken,
			refreshTokenExpiresAt: nextRefreshTokenExpiresAt,
			user: this.toAuthUser(currentToken.user),
		};
	}

	async logout(rawRefreshToken?: string) {
		if (!rawRefreshToken) {
			throw new MissingRefreshTokenError();
		}

		await this.repository.revokeRefreshTokenByHash(
			this.hashRefreshToken(rawRefreshToken),
		);
	}

	listSessions(userId: string) {
		return this.repository.findActiveSessions(userId);
	}

	async revokeSession(userId: string, sessionId: string) {
		await this.repository.revokeSession(userId, sessionId);
	}

	private async createSession(
		user: UserWithPassword,
		device: AuthDevice,
	): Promise<AuthSession> {
		const refreshToken = this.generateRefreshToken();
		const refreshTokenExpiresAt = this.getRefreshTokenExpiry();

		await this.repository.createRefreshToken({
			userId: user.id,
			tokenHash: this.hashRefreshToken(refreshToken),
			deviceId: device.id,
			deviceName: device.name,
			expiresAt: refreshTokenExpiresAt,
		});

		return {
			accessTokenPayload: this.createAccessTokenPayload(user),
			refreshToken,
			refreshTokenExpiresAt,
			user: this.toAuthUser(user),
		};
	}

	private createAccessTokenPayload(user: AuthUser): AccessTokenPayload {
		return {
			sub: user.id,
			email: user.email,
			role: user.role,
			tokenType: "access",
		};
	}

	private generateRefreshToken() {
		return randomBytes(64).toString("base64url");
	}

	private generateEmailOtp() {
		return String(randomInt(100000, 1000000));
	}

	private hashRefreshToken(refreshToken: string) {
		return createHash("sha256").update(refreshToken).digest("hex");
	}

	private hashEmailOtp(otp: string) {
		return createHash("sha256").update(otp).digest("hex");
	}

	private hashPassword(password: string) {
		return argon2.hash(password, { type: argon2.argon2id });
	}

	private async verifyPassword(password: string, passwordHash: string) {
		if (
			!this.isArgon2idHash(passwordHash) &&
			!this.isLegacyBcryptHash(passwordHash)
		) {
			return false;
		}
		try {
			return await argon2.verify(passwordHash, password);
		} catch {
			return false;
		}
	}

	private isArgon2idHash(passwordHash: string) {
		return passwordHash.startsWith("$argon2id$");
	}

	private isLegacyBcryptHash(passwordHash: string) {
		return /^\$2[aby]\$/.test(passwordHash);
	}

	private getRefreshTokenExpiry(rememberMe: boolean = false) {
		const expiresAt = new Date();
		expiresAt.setDate(
			expiresAt.getDate() + (rememberMe ? REFRESH_TOKEN_TTL_DAYS : 1),
		);
		return expiresAt;
	}

	private isUsableRefreshToken(
		token: RefreshTokenRecord | null,
	): token is RefreshTokenRecord {
		return Boolean(
			token && !token.revokedAt && token.expiresAt.getTime() > Date.now(),
		);
	}

	private isUsableEmailOtp(token: EmailOtpRecord, otp: string) {
		return (
			token.consumedAt === null &&
			token.expiresAt.getTime() > Date.now() &&
			token.otpHash === this.hashEmailOtp(otp)
		);
	}

	private toAuthUser(user: UserWithPassword): AuthUser {
		return {
			id: user.id,
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			role: user.role,
			emailVerified: user.emailVerified,
			verificationStatus: user.verificationStatus,
			verificationSubmittedAt: user.verificationSubmittedAt,
			profileCompleted: user.profileCompleted,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		};
	}

	private getGoogleFirstName(profile: GoogleUserInfo) {
		const emailPrefix = profile.email.split("@")[0] ?? "Google";
		return profile.given_name ?? profile.name?.split(" ")[0] ?? emailPrefix;
	}

	private getGoogleLastName(profile: GoogleUserInfo) {
		return (
			profile.family_name ??
			profile.name?.split(" ").slice(1).join(" ") ??
			"User"
		);
	}
}

export interface AuthRepositoryContract {
	findUserByEmail(email: string): Promise<UserWithPassword | null>;
	findUserByGoogleId(googleId: string): Promise<UserWithPassword | null>;
	findActiveBan(
		userId: string,
	): Promise<{ reason: string; expiresAt: Date | null } | null>;
	createUser(input: {
		firstName: string;
		lastName: string;
		email: string;
		passwordHash: string | null;
		googleId?: string | null;
		role: RegisterBody["role"];
		emailVerified?: boolean;
		emailVerifiedAt?: Date | null;
		profileCompleted?: boolean;
	}): Promise<UserWithPassword>;
	updateUserGoogleId(
		userId: string,
		googleId: string,
	): Promise<UserWithPassword>;
	updateUserEmailVerified(userId: string): Promise<UserWithPassword>;
	updatePasswordHash(userId: string, passwordHash: string): Promise<unknown>;
	createRefreshToken(input: CreateRefreshTokenInput): Promise<unknown>;
	findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
	rotateRefreshToken(
		currentTokenId: string,
		nextToken: CreateRefreshTokenInput,
	): Promise<unknown>;
	revokeRefreshTokenByHash(tokenHash: string): Promise<unknown>;
	findActiveSessions(userId: string): Promise<unknown>;
	revokeSession(userId: string, sessionId: string): Promise<unknown>;
	createEmailOtp(input: {
		userId: string;
		otpHash: string;
		expiresAt: Date;
	}): Promise<EmailOtpRecord>;
	findLatestEmailOtp(userId: string): Promise<EmailOtpRecord | null>;
	consumeEmailOtp(id: string): Promise<EmailOtpRecord>;
}

export type AuthDevice = {
	id: string;
	name: string | null;
};

const DEFAULT_AUTH_DEVICE: AuthDevice = { id: "legacy", name: null };
