import argon2 from "argon2";
import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailService } from "../email";
import {
	EmailAlreadyExistsError,
	EmailOtpRateLimitedError,
	GoogleAccountNotRegisteredError,
	InvalidCredentialsError,
	InvalidRefreshTokenError,
	UserBannedError,
} from "./auth.errors";
import { registerSchemaRequest } from "./auth.schema";
import { type AuthRepositoryContract, AuthService } from "./auth.service";
import type { UserWithPassword } from "./auth.types";

const now = new Date();

const user: UserWithPassword = {
	id: "018f6b4f-4580-7000-8000-000000000001",
	firstName: "Test",
	lastName: "User",
	email: "test@nsut.ac.in",
	passwordHash: "",
	googleId: null,
	role: "STUDENT",
	emailVerified: false,
	verificationStatus: null,
	verificationSubmittedAt: null,
	profileCompleted: false,
	createdAt: now,
	updatedAt: now,
};

type MockAuthRepository = AuthRepositoryContract & {
	[Key in keyof AuthRepositoryContract]: ReturnType<typeof vi.fn>;
};

const createRepository = (): MockAuthRepository =>
	({
		findUserByEmail: vi.fn(),
		findUserByGoogleId: vi.fn(),
		findActiveBan: vi.fn(),
		createUser: vi.fn(),
		updateUserGoogleId: vi.fn(),
		updateUserEmailVerified: vi.fn(),
		updatePasswordHash: vi.fn(),
		createRefreshToken: vi.fn(),
		findRefreshTokenByHash: vi.fn(),
		rotateRefreshToken: vi.fn(),
		revokeRefreshTokenByHash: vi.fn(),
		createEmailOtp: vi.fn(),
		findLatestEmailOtp: vi.fn(),
		consumeEmailOtp: vi.fn(),
	}) as MockAuthRepository;

describe("AuthService", () => {
	let repository: ReturnType<typeof createRepository>;
	let service: AuthService;

	beforeEach(() => {
		repository = createRepository();
		const mockEmailService: IEmailService = {
			sendEmailVerificationOtp: vi.fn().mockResolvedValue(undefined),
			sendAlumniDecision: vi.fn().mockResolvedValue(undefined),
		};
		service = new AuthService(repository, mockEmailService);
	});

	it("rejects duplicate registration emails", async () => {
		repository.findUserByEmail.mockResolvedValue(user);

		await expect(
			service.register({
				firstName: "Test",
				lastName: "User",
				email: user.email,
				password: "password123",
				role: "STUDENT",
			}),
		).rejects.toBeInstanceOf(EmailAlreadyExistsError);
	});

	it("rejects invalid login credentials", async () => {
		repository.findUserByEmail.mockResolvedValue({
			...user,
			passwordHash: await argon2.hash("correct-password", {
				type: argon2.argon2id,
			}),
		});

		await expect(
			service.login({
				email: user.email,
				password: "wrong-password",
			}),
		).rejects.toBeInstanceOf(InvalidCredentialsError);
	});

	it("verifies a legacy bcrypt password and upgrades it after login", async () => {
		repository.findUserByEmail.mockResolvedValue({
			...user,
			passwordHash: await bcrypt.hash("legacy-password", 4),
		});
		repository.findActiveBan.mockResolvedValue(null);

		await service.login({ email: user.email, password: "legacy-password" });

		expect(repository.updatePasswordHash).toHaveBeenCalledWith(
			user.id,
			expect.stringMatching(/^\$argon2id\$/),
		);
		const upgradedHash = repository.updatePasswordHash.mock.calls[0]?.[1];
		expect(await argon2.verify(upgradedHash as string, "legacy-password")).toBe(
			true,
		);
	});

	it("does not issue a new session to an actively banned user", async () => {
		repository.findUserByEmail.mockResolvedValue({
			...user,
			passwordHash: await argon2.hash("correct-password", {
				type: argon2.argon2id,
			}),
		});
		repository.findActiveBan.mockResolvedValue({
			reason: "Policy violation",
			expiresAt: null,
		});
		await expect(
			service.login({
				email: user.email,
				password: "correct-password",
			}),
		).rejects.toBeInstanceOf(UserBannedError);
		expect(repository.createRefreshToken).not.toHaveBeenCalled();
	});

	it("rotates a valid refresh token", async () => {
		const expiresAt = new Date(Date.now() + 60_000);

		repository.findRefreshTokenByHash.mockResolvedValue({
			id: "018f6b4f-4580-7000-8000-000000000002",
			userId: user.id,
			tokenHash: "stored-token-hash",
			deviceId: "legacy",
			deviceName: null,
			lastUsedAt: now,
			expiresAt,
			revokedAt: null,
			user,
		});

		const session = await service.refresh("raw-refresh-token");

		expect(repository.rotateRefreshToken).toHaveBeenCalledOnce();
		expect(session.refreshToken).not.toBe("raw-refresh-token");
		expect(session.accessTokenPayload.sub).toBe(user.id);
	});

	it("rejects revoked refresh tokens", async () => {
		repository.findRefreshTokenByHash.mockResolvedValue({
			id: "018f6b4f-4580-7000-8000-000000000003",
			userId: user.id,
			tokenHash: "stored-token-hash",
			deviceId: "legacy",
			deviceName: null,
			lastUsedAt: now,
			expiresAt: new Date(Date.now() + 60_000),
			revokedAt: new Date(),
			user,
		});

		await expect(service.refresh("raw-refresh-token")).rejects.toBeInstanceOf(
			InvalidRefreshTokenError,
		);
	});

	it("creates a session for a new google user", async () => {
		repository.findUserByGoogleId.mockResolvedValue(null);
		repository.findUserByEmail.mockResolvedValue(null);
		repository.createUser.mockResolvedValue({
			...user,
			email: "google@nsut.ac.in",
			passwordHash: null,
			googleId: "google-subject",
		});

		const session = await service.loginWithGoogle(
			{
				sub: "google-subject",
				email: "google@nsut.ac.in",
				given_name: "Google",
				family_name: "User",
			},
			undefined,
			"STUDENT",
		);

		expect(repository.createUser).toHaveBeenCalledWith(
			expect.objectContaining({
				email: "google@nsut.ac.in",
				googleId: "google-subject",
				passwordHash: null,
				role: "STUDENT",
			}),
		);
		expect(session.user.email).toBe("google@nsut.ac.in");
		expect(session.accessTokenPayload.sub).toBe(user.id);
	});

	it("honors the selected Google sign-up role", async () => {
		repository.findUserByGoogleId.mockResolvedValue(null);
		repository.findUserByEmail.mockResolvedValue(null);
		repository.createUser.mockResolvedValue({
			...user,
			email: "visitor@nsut.ac.in",
			googleId: "visitor-subject",
			role: "VISITOR",
			profileCompleted: true,
		});

		await service.loginWithGoogle(
			{
				sub: "visitor-subject",
				email: "visitor@nsut.ac.in",
			},
			undefined,
			"VISITOR",
		);

		expect(repository.createUser).toHaveBeenCalledWith(
			expect.objectContaining({ role: "VISITOR", profileCompleted: true }),
		);
	});

	it("revokes refresh token hashes on logout", async () => {
		await service.logout("raw-refresh-token");

		expect(repository.revokeRefreshTokenByHash).toHaveBeenCalledWith(
			expect.stringMatching(/^[a-f0-9]{64}$/),
		);
	});

	it("accepts the public sign-up roles but not administrators", () => {
		expect(
			registerSchemaRequest.safeParse({
				firstName: "Admin",
				lastName: "Attempt",
				email: "admin@example.com",
				password: "password123",
				role: "ADMIN",
			}).success,
		).toBe(false);
		expect(
			registerSchemaRequest.safeParse({
				firstName: "Alumni",
				email: "alumni@example.com",
				password: "password123",
				role: "ALUMNI",
			}).success,
		).toBe(true);
		for (const role of ["PROFESSOR", "VISITOR"] as const) {
			expect(
				registerSchemaRequest.safeParse({
					firstName: "Public",
					lastName: "User",
					email: "public@example.com",
					password: "password123",
					role,
				}).success,
			).toBe(true);
		}
	});

	it("keeps Google sign-in for existing accounts", async () => {
		repository.findUserByGoogleId.mockResolvedValue(null);
		repository.findUserByEmail.mockResolvedValue(null);

		await expect(
			service.loginWithGoogle({
				sub: "google-subject",
				email: "external@example.com",
			}),
		).rejects.toBeInstanceOf(GoogleAccountNotRegisteredError);
	});

	it("rate limits OTP resends while the latest code is active", async () => {
		repository.findLatestEmailOtp.mockResolvedValue({
			id: crypto.randomUUID(),
			userId: user.id,
			otpHash: "hash",
			expiresAt: new Date(Date.now() + 600_000),
			consumedAt: null,
			createdAt: new Date(),
		});
		await expect(service.sendEmailVerificationOtp(user)).rejects.toBeInstanceOf(
			EmailOtpRateLimitedError,
		);
		expect(repository.createEmailOtp).not.toHaveBeenCalled();
	});
});
