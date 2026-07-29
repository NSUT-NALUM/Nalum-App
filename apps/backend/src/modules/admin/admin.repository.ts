import type {
	Prisma,
	PrismaClient,
} from "../../database/prisma/generated/client";
import type { AdminUsersQuery, AlumniReviewQuery } from "./admin.schema";
import type { ReviewDecisionResult } from "./admin.types";

const activeBanWhere = (now: Date): Prisma.UserBanWhereInput => ({
	revokedAt: null,
	OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

const adminUserInclude = (now: Date) =>
	({
		profile: true,
		bans: {
			where: activeBanWhere(now),
			orderBy: { startsAt: "desc" },
		},
	}) satisfies Prisma.UserInclude;

export class AdminRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async getOverview() {
		const now = new Date();
		const recentCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
		const [
			totalUsers,
			roleCounts,
			alumniStatusCounts,
			activeBans,
			recentRegistrations,
		] = await this.prisma.$transaction([
			this.prisma.user.count(),
			this.prisma.user.groupBy({
				by: ["role"],
				orderBy: { role: "asc" },
				_count: true,
			}),
			this.prisma.user.groupBy({
				by: ["verificationStatus"],
				orderBy: { verificationStatus: "asc" },
				where: { role: "ALUMNI" },
				_count: true,
			}),
			this.prisma.userBan.count({ where: activeBanWhere(now) }),
			this.prisma.user.count({ where: { createdAt: { gte: recentCutoff } } }),
		]);

		const alumniStatuses = Object.fromEntries(
			alumniStatusCounts.map((row) => [
				row.verificationStatus ?? "UNSUBMITTED",
				row._count,
			]),
		);
		return {
			totalUsers,
			roleCounts: Object.fromEntries(
				roleCounts.map((row) => [row.role, row._count]),
			),
			alumniStatusCounts: alumniStatuses,
			pendingReviews: alumniStatuses.PENDING ?? 0,
			activeBans,
			recentRegistrations,
		};
	}

	async listAlumni(filters: AlumniReviewQuery) {
		const where: Prisma.UserWhereInput = {
			role: "ALUMNI",
			...(filters.status ? { verificationStatus: filters.status } : {}),
			...(filters.q
				? {
						OR: [
							{ firstName: { contains: filters.q, mode: "insensitive" } },
							{ lastName: { contains: filters.q, mode: "insensitive" } },
							{ email: { contains: filters.q, mode: "insensitive" } },
							{
								profile: {
									is: {
										rollNumber: {
											contains: filters.q,
											mode: "insensitive",
										},
									},
								},
							},
						],
					}
				: {}),
			...(filters.branch || filters.campus || filters.batch
				? {
						profile: {
							is: {
								...(filters.branch ? { branch: filters.branch } : {}),
								...(filters.campus ? { campus: filters.campus } : {}),
								...(filters.batch ? { batch: filters.batch } : {}),
							},
						},
					}
				: {}),
		};
		const now = new Date();
		const [users, total] = await this.prisma.$transaction([
			this.prisma.user.findMany({
				where,
				include: adminUserInclude(now),
				orderBy: [
					{ verificationSubmittedAt: { sort: "asc", nulls: "last" } },
					{ id: "asc" },
				],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.user.count({ where }),
		]);
		return { users, total, limit: filters.limit, offset: filters.offset };
	}

	findApplication(userId: string) {
		return this.prisma.user.findFirst({
			where: { id: userId, role: "ALUMNI" },
			include: {
				profile: true,
				socialMedia: true,
				experiences: { orderBy: { startDate: "desc" } },
				verificationEvents: {
					include: {
						actor: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								email: true,
							},
						},
					},
					orderBy: { createdAt: "desc" },
				},
				bans: {
					where: activeBanWhere(new Date()),
					orderBy: { startsAt: "desc" },
				},
			},
		});
	}

	async decideApplication(
		userId: string,
		actorId: string,
		status: "VERIFIED" | "REJECTED",
		reason: string | null,
	): Promise<ReviewDecisionResult | null> {
		return this.prisma.$transaction(async (tx) => {
			const updated = await tx.user.updateMany({
				where: {
					id: userId,
					role: "ALUMNI",
					verificationStatus: "PENDING",
					...(status === "VERIFIED"
						? { profile: { is: { rollNumber: { not: null } } } }
						: {}),
				},
				data: { verificationStatus: status },
			});
			if (updated.count !== 1) return null;

			const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
			const event = await tx.alumniVerificationEvent.create({
				data: {
					userId,
					actorId,
					type: status === "VERIFIED" ? "APPROVED" : "REJECTED",
					previousStatus: "PENDING",
					newStatus: status,
					reason,
					notificationState: "PENDING",
				},
			});
			return {
				eventId: event.id,
				userId,
				email: user.email,
				firstName: user.firstName,
				status,
				reason,
			};
		});
	}

	async reopenApplication(userId: string, actorId: string, reason: string) {
		return this.prisma.$transaction(async (tx) => {
			const user = await tx.user.findFirst({
				where: {
					id: userId,
					role: "ALUMNI",
					verificationStatus: { in: ["VERIFIED", "REJECTED"] },
				},
				select: { verificationStatus: true },
			});
			if (!user?.verificationStatus) return null;
			const submittedAt = new Date();
			const updated = await tx.user.updateMany({
				where: { id: userId, verificationStatus: user.verificationStatus },
				data: {
					verificationStatus: "PENDING",
					verificationSubmittedAt: submittedAt,
				},
			});
			if (updated.count !== 1) return null;
			return tx.alumniVerificationEvent.create({
				data: {
					userId,
					actorId,
					type: "REOPENED",
					previousStatus: user.verificationStatus,
					newStatus: "PENDING",
					reason,
					notificationState: "NOT_REQUIRED",
					createdAt: submittedAt,
				},
			});
		});
	}

	async listUsers(filters: AdminUsersQuery) {
		const now = new Date();
		const where: Prisma.UserWhereInput = {
			...(filters.q
				? {
						OR: [
							{ firstName: { contains: filters.q, mode: "insensitive" } },
							{ lastName: { contains: filters.q, mode: "insensitive" } },
							{ email: { contains: filters.q, mode: "insensitive" } },
						],
					}
				: {}),
			...(filters.role ? { role: filters.role } : {}),
			...(filters.verificationStatus
				? { verificationStatus: filters.verificationStatus }
				: {}),
			...(filters.banStatus === "ACTIVE"
				? { bans: { some: activeBanWhere(now) } }
				: filters.banStatus === "NONE"
					? { bans: { none: activeBanWhere(now) } }
					: {}),
			...(filters.registeredFrom || filters.registeredTo
				? {
						createdAt: {
							...(filters.registeredFrom
								? { gte: filters.registeredFrom }
								: {}),
							...(filters.registeredTo ? { lte: filters.registeredTo } : {}),
						},
					}
				: {}),
		};
		const [users, total] = await this.prisma.$transaction([
			this.prisma.user.findMany({
				where,
				include: adminUserInclude(now),
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.user.count({ where }),
		]);
		return { users, total, limit: filters.limit, offset: filters.offset };
	}

	findUser(userId: string) {
		return this.prisma.user.findUnique({
			where: { id: userId },
			include: {
				profile: true,
				socialMedia: true,
				experiences: { orderBy: { startDate: "desc" } },
				bans: { orderBy: { startsAt: "desc" } },
				verificationEvents: {
					include: {
						actor: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								email: true,
							},
						},
					},
					orderBy: { createdAt: "desc" },
				},
			},
		});
	}

	async banUser(
		userId: string,
		actorId: string,
		reason: string,
		expiresAt: Date | null,
	) {
		return this.prisma.$transaction(async (tx) => {
			const user = await tx.user.findUnique({ where: { id: userId } });
			if (!user) return { outcome: "NOT_FOUND" as const };
			if (user.role === "ADMIN") return { outcome: "PROTECTED" as const };
			const existing = await tx.userBan.findFirst({
				where: { userId, ...activeBanWhere(new Date()) },
			});
			if (existing) return { outcome: "ACTIVE" as const };
			const ban = await tx.userBan.create({
				data: { userId, bannedById: actorId, reason, expiresAt },
			});
			await tx.refreshToken.updateMany({
				where: { userId, revokedAt: null },
				data: { revokedAt: new Date() },
			});
			return { outcome: "BANNED" as const, ban };
		});
	}

	async unbanUser(userId: string, actorId: string) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		if (!user) return null;
		const revokedAt = new Date();
		await this.prisma.userBan.updateMany({
			where: { userId, ...activeBanWhere(revokedAt) },
			data: { revokedAt, revokedById: actorId },
		});
		return user;
	}

	markNotificationQueued(eventId: string) {
		return this.prisma.alumniVerificationEvent.update({
			where: { id: eventId },
			data: {
				notificationState: "QUEUED",
				notificationQueuedAt: new Date(),
				notificationError: null,
			},
		});
	}

	markNotificationFailed(eventId: string, error: string) {
		return this.prisma.alumniVerificationEvent.update({
			where: { id: eventId },
			data: {
				notificationState: "FAILED",
				notificationError: error.slice(0, 1000),
			},
		});
	}

	findPendingNotifications() {
		return this.prisma.alumniVerificationEvent.findMany({
			where: {
				type: { in: ["APPROVED", "REJECTED"] },
				notificationState: { in: ["PENDING", "FAILED"] },
			},
			include: { user: true },
			orderBy: { createdAt: "asc" },
			take: 100,
		});
	}
}
