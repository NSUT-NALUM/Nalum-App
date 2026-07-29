/**
 * auth Repository
 *
 * Responsibilities:
 * - Database access.
 * - Transactions.
 * - Data persistence.
 *
 * Do NOT:
 * - Implement business logic.
 */
import type { PrismaClient } from "../../database/prisma/generated/client";
import type {
	CreateRefreshTokenInput,
	CreateUserInput,
	EmailOtpRecord,
	UserWithPassword,
} from "./auth.types";

export default class AuthRepository {
	constructor(private readonly prisma: PrismaClient) {}

	findUserByEmail(email: string) {
		return this.prisma.user.findUnique({
			where: { email },
		});
	}

	findUserByGoogleId(googleId: string) {
		return this.prisma.$queryRaw<
			UserWithPassword[]
		>`SELECT * FROM "User" WHERE "googleId" = ${googleId} LIMIT 1`.then(
			(users) => users[0] ?? null,
		);
	}

	findUserById(id: string) {
		return this.prisma.user.findUnique({
			where: { id },
		});
	}

	findActiveBan(userId: string) {
		return this.prisma.userBan.findFirst({
			where: {
				userId,
				revokedAt: null,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
			orderBy: { startsAt: "desc" },
		});
	}

	createUser(input: CreateUserInput) {
		return this.prisma.user.create({
			data: input,
		});
	}

	updateUserGoogleId(userId: string, googleId: string) {
		return this.prisma.user.update({
			where: { id: userId },
			data: {
				googleId,
				emailVerified: true,
				emailVerifiedAt: new Date(),
			},
		});
	}

	updateUserEmailVerified(userId: string) {
		return this.prisma.user.update({
			where: { id: userId },
			data: {
				emailVerified: true,
				emailVerifiedAt: new Date(),
			},
		});
	}

	updatePasswordHash(userId: string, passwordHash: string) {
		return this.prisma.user.update({
			where: { id: userId },
			data: { passwordHash },
		});
	}

	createRefreshToken(input: CreateRefreshTokenInput) {
		return this.prisma.refreshToken.create({
			data: input,
		});
	}

	findRefreshTokenByHash(tokenHash: string) {
		return this.prisma.refreshToken.findUnique({
			where: { tokenHash },
			include: {
				user: true,
			},
		});
	}

	rotateRefreshToken(
		currentTokenId: string,
		nextToken: CreateRefreshTokenInput,
	) {
		return this.prisma.$transaction(async (tx) => {
			return tx.refreshToken.update({
				where: { id: currentTokenId },
				data: {
					tokenHash: nextToken.tokenHash,
					deviceId: nextToken.deviceId,
					deviceName: nextToken.deviceName,
					expiresAt: nextToken.expiresAt,
					lastUsedAt: new Date(),
				},
			});
		});
	}

	async revokeRefreshTokenByHash(tokenHash: string) {
		const token = await this.prisma.refreshToken.findUnique({
			where: { tokenHash },
		});

		if (!token || token.revokedAt) {
			return null;
		}

		return this.prisma.refreshToken.update({
			where: { id: token.id },
			data: { revokedAt: new Date() },
		});
	}

	findActiveSessions(userId: string) {
		return this.prisma.refreshToken.findMany({
			where: {
				userId,
				revokedAt: null,
				expiresAt: { gt: new Date() },
			},
			select: {
				id: true,
				deviceId: true,
				deviceName: true,
				lastUsedAt: true,
				createdAt: true,
				expiresAt: true,
			},
			orderBy: { lastUsedAt: "desc" },
		});
	}

	revokeSession(userId: string, sessionId: string) {
		return this.prisma.refreshToken.updateMany({
			where: { id: sessionId, userId, revokedAt: null },
			data: { revokedAt: new Date() },
		});
	}

	async createEmailOtp(input: {
		userId: string;
		otpHash: string;
		expiresAt: Date;
	}): Promise<EmailOtpRecord> {
		return this.prisma.$transaction(async (tx) => {
			await tx.emailOtp.updateMany({
				where: {
					userId: input.userId,
					consumedAt: null,
				},
				data: {
					consumedAt: new Date(),
				},
			});

			return tx.emailOtp.create({
				data: input,
			});
		});
	}

	findLatestEmailOtp(userId: string): Promise<EmailOtpRecord | null> {
		return this.prisma.emailOtp.findFirst({
			where: {
				userId,
				consumedAt: null,
			},
			orderBy: {
				createdAt: "desc",
			},
		});
	}

	consumeEmailOtp(id: string): Promise<EmailOtpRecord> {
		return this.prisma.emailOtp.update({
			where: { id },
			data: {
				consumedAt: new Date(),
			},
		});
	}
}
