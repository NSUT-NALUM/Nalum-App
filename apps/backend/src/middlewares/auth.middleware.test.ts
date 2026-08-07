import { describe, expect, it, vi } from "vitest";
import { requirePlatformAccess, requireProfileAccess } from "./auth.middleware";

const baseUser = {
	id: "018f6b4f-4580-7000-8000-000000000001",
	firstName: "Test",
	lastName: "User",
	email: "alumni@example.com",
	passwordHash: null,
	googleId: null,
	role: "ALUMNI" as const,
	emailVerified: true,
	emailVerifiedAt: new Date(),
	verificationStatus: "VERIFIED" as const,
	verificationSubmittedAt: new Date(),
	profileCompleted: true,
	createdAt: new Date(),
	updatedAt: new Date(),
	lastSeenAt: null,
	bans: [],
};

const requestFor = (user: { id: string } & Record<string, unknown>) =>
	({
		jwtVerify: vi.fn().mockResolvedValue({
			sub: user.id,
			tokenType: "access",
		}),
		user: { sub: user.id, tokenType: "access" },
		server: {
			prisma: {
				user: { findUnique: vi.fn().mockResolvedValue(user) },
			},
		},
	}) as never;

describe("platform access guard", () => {
	it("allows verified alumni", async () => {
		await expect(
			requirePlatformAccess(requestFor(baseUser), {} as never),
		).resolves.toBeUndefined();
	});

	it.each([
		["PENDING", "ALUMNI_VERIFICATION_PENDING"],
		["REJECTED", "ALUMNI_VERIFICATION_REJECTED"],
	] as const)("rejects %s alumni with a stable code", async (status, code) => {
		const error = await requirePlatformAccess(
			requestFor({ ...baseUser, verificationStatus: status }),
			{} as never,
		).catch((caught) => caught);
		expect(error.error).toMatchObject({ statusCode: 403, code });
	});

	it("allows pending alumni to complete their own profile", async () => {
		await expect(
			requireProfileAccess(
				requestFor({ ...baseUser, verificationStatus: "PENDING" }),
				{} as never,
			),
		).resolves.toBeUndefined();
	});

	it("rejects visitors from member APIs", async () => {
		const error = await requirePlatformAccess(
			requestFor({
				...baseUser,
				role: "VISITOR",
				verificationStatus: null,
			}),
			{} as never,
		).catch((caught) => caught);
		expect(error.error).toMatchObject({
			statusCode: 403,
			code: "MEMBER_ACCESS_REQUIRED",
		});
	});

	it("returns active ban details", async () => {
		const error = await requirePlatformAccess(
			requestFor({
				...baseUser,
				bans: [
					{
						id: crypto.randomUUID(),
						userId: baseUser.id,
						reason: "Abuse",
						startsAt: new Date(),
						expiresAt: null,
						revokedAt: null,
						bannedById: null,
						revokedById: null,
					},
				],
			}),
			{} as never,
		).catch((caught) => caught);
		expect(error.error).toMatchObject({
			statusCode: 403,
			code: "USER_BANNED",
			details: { reason: "Abuse", permanent: true },
		});
	});
});
