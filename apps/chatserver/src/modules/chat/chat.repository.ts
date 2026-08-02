import type { PrismaClient } from "@nalum/database/client";

const messageInclude = {
	attachments: true,
	mentions: true,
	reactions: true,
};

const memberInclude = {
	user: { select: { id: true, firstName: true, lastName: true } },
};

const groupInvitationInclude = {
	conversation: { select: { id: true, name: true, type: true } },
	inviter: { select: { id: true, firstName: true, lastName: true } },
};

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

	findConnectionRequest(pairKey: string) {
		return this.prisma.connectionRequest.findUnique({ where: { pairKey } });
	}

	findConnectionRequestForRecipient(id: string, recipientId: string) {
		return this.prisma.connectionRequest.findFirst({
			where: { id, recipientId },
		});
	}

	listConnectionRequests(userId: string, direction: "incoming" | "outgoing") {
		const incoming = direction === "incoming";
		return this.prisma.connectionRequest.findMany({
			where: incoming
				? { recipientId: userId, status: "PENDING" }
				: { requesterId: userId, status: "PENDING" },
			include: {
				requester: { select: { id: true, firstName: true, lastName: true } },
				recipient: { select: { id: true, firstName: true, lastName: true } },
			},
			orderBy: { updatedAt: "desc" },
		});
	}

	upsertConnectionRequest(input: {
		pairKey: string;
		requesterId: string;
		recipientId: string;
		text: string;
	}) {
		return this.prisma.connectionRequest.upsert({
			where: { pairKey: input.pairKey },
			create: input,
			update: {
				requesterId: input.requesterId,
				recipientId: input.recipientId,
				text: input.text,
				status: "PENDING",
				respondedAt: null,
			},
		});
	}

	async acceptConnectionRequest(
		id: string,
		recipientId: string,
		pairKey: string,
		userIds: [string, string],
	) {
		return this.prisma.$transaction(async (tx) => {
			const updated = await tx.connectionRequest.updateMany({
				where: { id, recipientId, status: "PENDING" },
				data: { status: "ACCEPTED", respondedAt: new Date() },
			});
			if (updated.count !== 1) return null;
			const conversation = await tx.conversation.upsert({
				where: { directPairKey: pairKey },
				create: {
					type: "DIRECT",
					directPairKey: pairKey,
					participants: { create: userIds.map((userId) => ({ userId })) },
				},
				update: {},
				include: { participants: { where: { leftAt: null } } },
			});
			const request = await tx.connectionRequest.findUniqueOrThrow({
				where: { id },
			});
			return { request, conversation };
		});
	}

	declineConnectionRequest(id: string, recipientId: string) {
		return this.prisma.connectionRequest.updateMany({
			where: { id, recipientId, status: "PENDING" },
			data: { status: "DECLINED", respondedAt: new Date() },
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
			include: { conversation: true, ...memberInclude },
		});
	}

	findActiveParticipants(conversationId: string) {
		return this.prisma.conversationParticipant.findMany({
			where: { conversationId, leftAt: null },
			select: {
				userId: true,
				lastReadMessageId: true,
				lastReadAt: true,
			},
		});
	}

	findMessage(messageId: string) {
		return this.prisma.message.findUnique({
			where: { id: messageId },
			include: messageInclude,
		});
	}

	findMessageCursors(ids: string[]) {
		return this.prisma.message.findMany({
			where: { id: { in: ids } },
			select: { id: true, createdAt: true },
		});
	}

	findMessageByClientId(
		conversationId: string,
		senderId: string,
		clientMessageId: string,
	) {
		return this.prisma.message.findUnique({
			where: {
				conversationId_senderId_clientMessageId: {
					conversationId,
					senderId,
					clientMessageId,
				},
			},
			include: messageInclude,
		});
	}

	findPendingAttachments(
		conversationId: string,
		ownerId: string,
		ids: string[],
	) {
		return this.prisma.messageAttachment.findMany({
			where: { id: { in: ids }, conversationId, ownerId, messageId: null },
			select: { id: true },
		});
	}

	async createMessage(input: {
		conversationId: string;
		senderId: string;
		clientMessageId: string;
		text: string;
		attachmentIds: string[];
		replyToId?: string;
		replyPreview?: string;
		replySenderId?: string;
		mentionUserIds: string[];
		mentionsEveryone: boolean;
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
				include: messageInclude,
			});
			if (existing) return { message: existing, created: false };
			const message = await tx.message.create({
				data: {
					conversationId: input.conversationId,
					senderId: input.senderId,
					clientMessageId: input.clientMessageId,
					text: input.text,
					replyToId: input.replyToId,
					replyPreview: input.replyPreview,
					replySenderId: input.replySenderId,
					mentionsEveryone: input.mentionsEveryone,
					attachments: input.attachmentIds.length
						? { connect: input.attachmentIds.map((id) => ({ id })) }
						: undefined,
					mentions: input.mentionUserIds.length
						? { create: input.mentionUserIds.map((userId) => ({ userId })) }
						: undefined,
				},
				include: messageInclude,
			});
			await tx.conversation.update({
				where: { id: input.conversationId },
				data: { lastMessageAt: message.createdAt },
			});
			return { message, created: true };
		});
	}

	updateMessage(
		messageId: string,
		input: {
			text: string;
			mentionUserIds: string[];
			mentionsEveryone: boolean;
		},
	) {
		return this.prisma.message.update({
			where: { id: messageId },
			data: {
				text: input.text,
				editedAt: new Date(),
				mentionsEveryone: input.mentionsEveryone,
				mentions: {
					deleteMany: {},
					create: input.mentionUserIds.map((userId) => ({ userId })),
				},
			},
			include: messageInclude,
		});
	}

	softDeleteMessage(messageId: string) {
		return this.prisma.$transaction(async (tx) => {
			await tx.messageReaction.deleteMany({ where: { messageId } });
			await tx.messageMention.deleteMany({ where: { messageId } });
			return tx.message.update({
				where: { id: messageId },
				data: {
					deletedAt: new Date(),
					mentionsEveryone: false,
				},
				include: messageInclude,
			});
		});
	}

	async toggleReaction(messageId: string, userId: string, emoji: string) {
		return this.prisma.$transaction(async (tx) => {
			const existing = await tx.messageReaction.findUnique({
				where: { messageId_userId_emoji: { messageId, userId, emoji } },
			});
			if (existing) {
				await tx.messageReaction.delete({
					where: { messageId_userId_emoji: { messageId, userId, emoji } },
				});
			} else {
				await tx.messageReaction.create({ data: { messageId, userId, emoji } });
			}
			const count = await tx.messageReaction.count({
				where: { messageId, emoji },
			});
			return { active: !existing, count };
		});
	}

	updateReadReceipt(conversationId: string, userId: string, messageId: string) {
		return this.prisma.conversationParticipant.update({
			where: { conversationId_userId: { conversationId, userId } },
			data: { lastReadMessageId: messageId, lastReadAt: new Date() },
			select: { userId: true, lastReadMessageId: true, lastReadAt: true },
		});
	}

	createSystemMessage(conversationId: string, senderId: string, text: string) {
		return this.prisma.$transaction(async (tx) => {
			const message = await tx.message.create({
				data: {
					conversationId,
					senderId,
					clientMessageId: `system-${crypto.randomUUID()}`,
					text,
					type: "SYSTEM",
				},
				include: messageInclude,
			});
			await tx.conversation.update({
				where: { id: conversationId },
				data: { lastMessageAt: message.createdAt },
			});
			return message;
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
			include: messageInclude,
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
					select: {
						userId: true,
						role: true,
						joinedAt: true,
						lastReadMessageId: true,
						lastReadAt: true,
						user: { select: { firstName: true, lastName: true } },
					},
				},
				messages: {
					include: messageInclude,
					orderBy: { createdAt: "desc" },
					take: 1,
				},
			},
			orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
			take: limit + 1,
		});
	}

	createGroup(name: string, ownerId: string, inviteeIds: string[]) {
		return this.prisma.conversation.create({
			data: {
				type: "GROUP",
				name,
				participants: {
					create: { userId: ownerId, role: "OWNER" },
				},
				groupInvitations: {
					create: inviteeIds.map((inviteeId) => ({
						inviterId: ownerId,
						inviteeId,
					})),
				},
			},
			include: {
				participants: { where: { leftAt: null } },
				groupInvitations: { include: groupInvitationInclude },
			},
		});
	}

	findGroupInvitation(conversationId: string, inviteeId: string) {
		return this.prisma.groupInvitation.findUnique({
			where: { conversationId_inviteeId: { conversationId, inviteeId } },
			include: groupInvitationInclude,
		});
	}

	upsertGroupInvitation(input: {
		conversationId: string;
		inviterId: string;
		inviteeId: string;
	}) {
		return this.prisma.groupInvitation.upsert({
			where: {
				conversationId_inviteeId: {
					conversationId: input.conversationId,
					inviteeId: input.inviteeId,
				},
			},
			create: input,
			update: { inviterId: input.inviterId, status: "PENDING" },
			include: groupInvitationInclude,
		});
	}

	listGroupInvitations(userId: string) {
		return this.prisma.groupInvitation.findMany({
			where: { inviteeId: userId, status: "PENDING" },
			include: groupInvitationInclude,
			orderBy: { updatedAt: "desc" },
		});
	}

	findGroupInvitationForInvitee(id: string, inviteeId: string) {
		return this.prisma.groupInvitation.findFirst({
			where: { id, inviteeId },
			include: groupInvitationInclude,
		});
	}

	async acceptGroupInvitation(id: string, inviteeId: string) {
		return this.prisma.$transaction(async (tx) => {
			const invitation = await tx.groupInvitation.findFirst({
				where: { id, inviteeId, status: "PENDING" },
				include: groupInvitationInclude,
			});
			if (!invitation) return null;
			const member = await tx.conversationParticipant.upsert({
				where: {
					conversationId_userId: {
						conversationId: invitation.conversationId,
						userId: inviteeId,
					},
				},
				create: {
					conversationId: invitation.conversationId,
					userId: inviteeId,
				},
				update: {
					leftAt: null,
					joinedAt: new Date(),
					role: "MEMBER",
					lastReadMessageId: null,
					lastReadAt: null,
				},
				include: memberInclude,
			});
			await tx.groupInvitation.update({
				where: { id },
				data: { status: "ACCEPTED" },
			});
			return { invitation, member };
		});
	}

	declineGroupInvitation(id: string, inviteeId: string) {
		return this.prisma.groupInvitation.updateMany({
			where: { id, inviteeId, status: "PENDING" },
			data: { status: "DECLINED" },
		});
	}

	removeMember(conversationId: string, userId: string) {
		return this.prisma.conversationParticipant.update({
			where: { conversationId_userId: { conversationId, userId } },
			data: { leftAt: new Date() },
			include: memberInclude,
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
			include: memberInclude,
		});
	}

	async transferOwnership(
		conversationId: string,
		ownerId: string,
		userId: string,
	) {
		return this.prisma.$transaction(async (tx) => {
			await tx.conversationParticipant.update({
				where: { conversationId_userId: { conversationId, userId: ownerId } },
				data: { role: "ADMIN" },
			});
			return tx.conversationParticipant.update({
				where: { conversationId_userId: { conversationId, userId } },
				data: { role: "OWNER" },
				include: memberInclude,
			});
		});
	}

	countUnreadMessages(input: {
		conversationId: string;
		userId: string;
		joinedAt: Date;
		lastReadMessage: { createdAt: Date; id: string } | undefined;
		mentionsOnly?: boolean;
	}) {
		return this.prisma.message.count({
			where: {
				conversationId: input.conversationId,
				type: "USER",
				deletedAt: null,
				senderId: { not: input.userId },
				createdAt: { gte: input.joinedAt },
				...(input.lastReadMessage
					? {
							OR: [
								{ createdAt: { gt: input.lastReadMessage.createdAt } },
								{
									createdAt: input.lastReadMessage.createdAt,
									id: { gt: input.lastReadMessage.id },
								},
							],
						}
					: {}),
				...(input.mentionsOnly
					? {
							AND: [
								{
									OR: [
										{ mentionsEveryone: true },
										{ mentions: { some: { userId: input.userId } } },
									],
								},
							],
						}
					: {}),
			},
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
