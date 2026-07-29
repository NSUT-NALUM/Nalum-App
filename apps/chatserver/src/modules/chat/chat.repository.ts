import type { PrismaClient } from "@nalum/database/client";

export class ChatRepository {
	constructor(private readonly prisma: PrismaClient) {}

	findUserById(id: string) {
		return this.prisma.user.findFirst({
			where: { id, ...this.eligibleUserWhere() },
		});
	}

	findUsersByIds(ids: string[]) {
		return this.prisma.user.findMany({
			where: { id: { in: ids }, ...this.eligibleUserWhere() },
			select: { id: true },
		});
	}

	findDirectConversation(directPairKey: string) {
		return this.prisma.conversation.findUnique({
			where: { directPairKey },
			include: { participants: { where: { leftAt: null } } },
		});
	}

	createDirectConversation(directPairKey: string, userIds: [string, string]) {
		return this.prisma.conversation.create({
			data: {
				type: "DIRECT",
				directPairKey,
				participants: { create: userIds.map((userId) => ({ userId })) },
			},
			include: { participants: { where: { leftAt: null } } },
		});
	}

	findParticipant(conversationId: string, userId: string) {
		return this.prisma.conversationParticipant.findUnique({
			where: { conversationId_userId: { conversationId, userId } },
			include: { conversation: true },
		});
	}

	findConversation(conversationId: string) {
		return this.prisma.conversation.findUnique({
			where: { id: conversationId },
		});
	}

	async createMessage(input: {
		conversationId: string;
		senderId: string;
		clientMessageId: string;
		text: string;
	}) {
		return this.prisma.$transaction(async (tx) => {
			const existing = await tx.message.findUnique({
				where: {
					conversationId_senderId_clientMessageId: {
						conversationId: input.conversationId,
						senderId: input.senderId,
						clientMessageId: input.clientMessageId,
					},
				},
			});
			if (existing) return { message: existing, created: false };
			const message = await tx.message.create({ data: input });
			await tx.conversation.update({
				where: { id: input.conversationId },
				data: { lastMessageAt: message.createdAt },
			});
			return { message, created: true };
		});
	}

	findActiveParticipantUserIds(conversationId: string) {
		return this.prisma.conversationParticipant.findMany({
			where: {
				conversationId,
				leftAt: null,
				user: this.eligibleUserWhere(),
			},
			select: { userId: true },
		});
	}

	findPresenceAudienceUserIds(userId: string) {
		return this.prisma.conversationParticipant.findMany({
			where: {
				leftAt: null,
				user: this.eligibleUserWhere(),
				conversation: { participants: { some: { userId, leftAt: null } } },
			},
			select: { userId: true },
			distinct: ["userId"],
		});
	}

	updateLastSeenAt(userId: string, lastSeenAt: Date) {
		return this.prisma.user.update({
			where: { id: userId },
			data: { lastSeenAt },
		});
	}

	findMessages(
		conversationId: string,
		cursor: { createdAt: Date; id: string } | null,
		limit: number,
	) {
		return this.prisma.message.findMany({
			where: {
				conversationId,
				...(cursor
					? {
							OR: [
								{ createdAt: { lt: cursor.createdAt } },
								{ createdAt: cursor.createdAt, id: { lt: cursor.id } },
							],
						}
					: {}),
			},
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: limit + 1,
		});
	}

	findConversations(
		userId: string,
		cursor: { lastMessageAt: Date; id: string } | null,
		limit: number,
	) {
		return this.prisma.conversation.findMany({
			where: {
				participants: { some: { userId, leftAt: null } },
				...(cursor
					? {
							OR: [
								{ lastMessageAt: { lt: cursor.lastMessageAt } },
								{ lastMessageAt: cursor.lastMessageAt, id: { lt: cursor.id } },
							],
						}
					: {}),
			},
			include: {
				participants: {
					where: { leftAt: null },
					select: { userId: true, role: true },
				},
				messages: { orderBy: { createdAt: "desc" }, take: 1 },
			},
			orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
			take: limit + 1,
		});
	}

	createGroup(name: string, ownerId: string, memberIds: string[]) {
		return this.prisma.conversation.create({
			data: {
				type: "GROUP",
				name,
				participants: {
					create: memberIds.map((userId) => ({
						userId,
						role: userId === ownerId ? "OWNER" : "MEMBER",
					})),
				},
			},
			include: { participants: { where: { leftAt: null } } },
		});
	}

	upsertMember(conversationId: string, userId: string) {
		return this.prisma.conversationParticipant.upsert({
			where: { conversationId_userId: { conversationId, userId } },
			create: { conversationId, userId },
			update: { leftAt: null, joinedAt: new Date(), role: "MEMBER" },
		});
	}

	removeMember(conversationId: string, userId: string) {
		return this.prisma.conversationParticipant.update({
			where: { conversationId_userId: { conversationId, userId } },
			data: { leftAt: new Date() },
		});
	}

	updateMemberRole(
		conversationId: string,
		userId: string,
		role: "ADMIN" | "MEMBER",
	) {
		return this.prisma.conversationParticipant.update({
			where: { conversationId_userId: { conversationId, userId } },
			data: { role },
		});
	}

	private eligibleUserWhere() {
		const now = new Date();
		return {
			AND: [
				{
					OR: [
						{ role: { not: "ALUMNI" as const } },
						{
							role: "ALUMNI" as const,
							verificationStatus: "VERIFIED" as const,
						},
					],
				},
				{
					bans: {
						none: {
							revokedAt: null,
							OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
						},
					},
				},
			],
		};
	}
}
