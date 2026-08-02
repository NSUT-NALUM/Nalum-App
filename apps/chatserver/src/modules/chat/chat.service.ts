import type { ConversationParticipantRole } from "../../../../../apps/backend/src/database/prisma/generated/enums";
import { ChatError } from "./chat.errors";
import type { ChatRepository } from "./chat.repository";
import type { MessageEditInput, MessageSendInput } from "./chat.schema";

type Cursor = { createdAt?: Date; lastMessageAt?: Date; id: string };
type MessageDetails = {
	id: string;
	conversationId: string;
	senderId: string;
	clientMessageId: string;
	text: string;
	type: "USER" | "SYSTEM";
	replyToId: string | null;
	replyPreview: string | null;
	replySenderId: string | null;
	editedAt: Date | null;
	deletedAt: Date | null;
	mentionsEveryone: boolean;
	createdAt: Date;
	attachments: Array<{ id: string; key: string; contentType: string }>;
	mentions: Array<{ userId: string }>;
	reactions: Array<{ userId: string; emoji: string }>;
};

export class ChatService {
	constructor(private readonly repository: ChatRepository) {}

	async createDirectConversation(userId: string, recipientUserId: string) {
		if (userId === recipientUserId) {
			throw new ChatError(
				"You cannot create a conversation with yourself",
				400,
				"CHAT_SELF_DIRECT",
			);
		}
		const recipient = await this.repository.findUserById(recipientUserId);
		if (!recipient)
			throw new ChatError(
				"Recipient not found",
				404,
				"CHAT_RECIPIENT_NOT_FOUND",
			);
		const userIds = [userId, recipientUserId].sort() as [string, string];
		const directPairKey = userIds.join(":");
		const connectionRequest =
			await this.repository.findConnectionRequest(directPairKey);
		if (connectionRequest?.status !== "ACCEPTED") {
			throw new ChatError(
				"Accept a connection request before messaging",
				403,
				"CHAT_CONNECTION_REQUIRED",
			);
		}
		const existing =
			await this.repository.findDirectConversation(directPairKey);
		if (existing) return existing;
		try {
			return await this.repository.createDirectConversation(
				directPairKey,
				userIds,
			);
		} catch (error) {
			const racedConversation =
				await this.repository.findDirectConversation(directPairKey);
			if (racedConversation) return racedConversation;
			throw error;
		}
	}

	async createConnectionRequest(
		userId: string,
		recipientUserId: string,
		text: string,
	) {
		if (userId === recipientUserId) {
			throw new ChatError(
				"You cannot connect with yourself",
				400,
				"CHAT_SELF_CONNECTION",
			);
		}
		if (!(await this.repository.findUserById(recipientUserId))) {
			throw new ChatError(
				"Recipient not found",
				404,
				"CHAT_RECIPIENT_NOT_FOUND",
			);
		}
		const userIds = [userId, recipientUserId].sort() as [string, string];
		const pairKey = userIds.join(":");
		const existing = await this.repository.findConnectionRequest(pairKey);
		if (existing?.status === "ACCEPTED") {
			throw new ChatError(
				"You are already connected",
				409,
				"CHAT_CONNECTION_EXISTS",
			);
		}
		if (existing?.status === "PENDING") {
			throw new ChatError(
				"A connection request is already pending",
				409,
				"CHAT_CONNECTION_PENDING",
			);
		}
		if (
			existing &&
			existing.updatedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
		) {
			throw new ChatError(
				"You can send another request in 30 days",
				429,
				"CHAT_CONNECTION_COOLDOWN",
			);
		}
		return this.repository.upsertConnectionRequest({
			pairKey,
			requesterId: userId,
			recipientId: recipientUserId,
			text,
		});
	}

	getConnectionRequests(userId: string, direction: "incoming" | "outgoing") {
		return this.repository.listConnectionRequests(userId, direction);
	}

	async acceptConnectionRequest(userId: string, requestId: string) {
		const request = await this.repository.findConnectionRequestForRecipient(
			requestId,
			userId,
		);
		if (!request)
			throw new ChatError(
				"Connection request not found",
				404,
				"CHAT_CONNECTION_NOT_FOUND",
			);
		if (!(await this.repository.findUserById(request.requesterId))) {
			throw new ChatError(
				"Requester is no longer available",
				404,
				"CHAT_REQUESTER_NOT_FOUND",
			);
		}
		const userIds = [request.requesterId, request.recipientId].sort() as [
			string,
			string,
		];
		const result = await this.repository.acceptConnectionRequest(
			request.id,
			userId,
			request.pairKey,
			userIds,
		);
		if (!result)
			throw new ChatError(
				"Connection request is no longer pending",
				409,
				"CHAT_CONNECTION_NOT_PENDING",
			);
		return result;
	}

	async declineConnectionRequest(userId: string, requestId: string) {
		const request = await this.repository.findConnectionRequestForRecipient(
			requestId,
			userId,
		);
		if (!request)
			throw new ChatError(
				"Connection request not found",
				404,
				"CHAT_CONNECTION_NOT_FOUND",
			);
		const updated = await this.repository.declineConnectionRequest(
			requestId,
			userId,
		);
		if (updated.count !== 1)
			throw new ChatError(
				"Connection request is no longer pending",
				409,
				"CHAT_CONNECTION_NOT_PENDING",
			);
		return request;
	}

	async sendMessage(userId: string, input: MessageSendInput) {
		const existing = await this.repository.findMessageByClientId(
			input.conversationId,
			userId,
			input.clientMessageId,
		);
		if (existing)
			return { message: this.toMessage(existing, userId), created: false };
		const participant = await this.requireActiveParticipant(
			input.conversationId,
			userId,
		);
		const reply = await this.resolveReply(
			input.conversationId,
			input.replyToId,
		);
		await this.validateAttachments(
			input.conversationId,
			userId,
			input.attachmentIds,
		);
		await this.validateMentions(
			participant,
			input.mentionUserIds,
			input.mentionsEveryone,
		);
		const result = await this.repository.createMessage({
			...input,
			senderId: userId,
			replyToId: reply?.id,
			replyPreview: reply?.preview,
			replySenderId: reply?.senderId,
		});
		return { ...result, message: this.toMessage(result.message, userId) };
	}

	async editMessage(userId: string, input: MessageEditInput) {
		const message = await this.requireEditableMessage(userId, input.messageId);
		const participant = await this.requireActiveParticipant(
			message.conversationId,
			userId,
		);
		await this.validateMentions(
			participant,
			input.mentionUserIds,
			input.mentionsEveryone,
		);
		return this.toMessage(
			await this.repository.updateMessage(input.messageId, input),
			userId,
		);
	}

	async deleteMessage(userId: string, messageId: string) {
		const message = await this.requireEditableMessage(userId, messageId, false);
		await this.requireActiveParticipant(message.conversationId, userId);
		return this.toMessage(
			await this.repository.softDeleteMessage(messageId),
			userId,
		);
	}

	async toggleReaction(userId: string, messageId: string, emoji: string) {
		const message = await this.repository.findMessage(messageId);
		if (!message || message.deletedAt || message.type !== "USER") {
			throw new ChatError(
				"Message is unavailable",
				404,
				"CHAT_MESSAGE_NOT_FOUND",
			);
		}
		await this.requireActiveParticipant(message.conversationId, userId);
		return {
			conversationId: message.conversationId,
			messageId,
			emoji,
			userId,
			...(await this.repository.toggleReaction(messageId, userId, emoji)),
		};
	}

	async markRead(userId: string, conversationId: string, messageId: string) {
		const participant = await this.requireActiveParticipant(
			conversationId,
			userId,
		);
		const message = await this.repository.findMessage(messageId);
		if (!message || message.conversationId !== conversationId) {
			throw new ChatError("Message not found", 404, "CHAT_MESSAGE_NOT_FOUND");
		}
		if (participant.lastReadMessageId) {
			const current = await this.repository.findMessage(
				participant.lastReadMessageId,
			);
			if (
				current &&
				(current.createdAt > message.createdAt ||
					(current.createdAt.getTime() === message.createdAt.getTime() &&
						current.id >= message.id))
			)
				return {
					userId,
					lastReadMessageId: current.id,
					lastReadAt: participant.lastReadAt,
				};
		}
		return this.repository.updateReadReceipt(conversationId, userId, messageId);
	}

	async getMessages(
		userId: string,
		conversationId: string,
		cursorValue: string | undefined,
		limit: number,
	) {
		const participant = await this.requireActiveParticipant(
			conversationId,
			userId,
		);
		const cursor = this.decodeCursor(cursorValue, "message") as
			| (Cursor & { createdAt: Date })
			| null;
		const rows = await this.repository.findMessages(
			conversationId,
			cursor,
			limit,
		);
		const hasMore = rows.length > limit;
		const messages = hasMore ? rows.slice(0, limit) : rows;
		const lastMessage = messages.at(-1);
		const readReceipts =
			await this.repository.findActiveParticipants(conversationId);
		return {
			messages: messages.map((message) => this.toMessage(message, userId)),
			readReceipt: {
				userId: participant.userId,
				lastReadMessageId: participant.lastReadMessageId,
				lastReadAt: participant.lastReadAt,
			},
			readReceipts,
			nextCursor:
				hasMore && lastMessage
					? this.encodeCursor({
							createdAt: lastMessage.createdAt,
							id: lastMessage.id,
						})
					: null,
		};
	}

	async getConversations(
		userId: string,
		cursorValue: string | undefined,
		limit: number,
	) {
		const cursor = this.decodeCursor(cursorValue, "conversation") as
			| (Cursor & { lastMessageAt: Date })
			| null;
		const rows = await this.repository.findConversations(userId, cursor, limit);
		const hasMore = rows.length > limit;
		const conversations = hasMore ? rows.slice(0, limit) : rows;
		const lastConversation = conversations.at(-1);
		const cursorIds = conversations
			.map(
				(conversation) =>
					conversation.participants.find(
						(participant) => participant.userId === userId,
					)?.lastReadMessageId,
			)
			.filter((id): id is string => Boolean(id));
		const messageCursors = new Map(
			(await this.repository.findMessageCursors(cursorIds)).map((message) => [
				message.id,
				message,
			]),
		);
		return {
			// ponytail: two counts per page item; replace with an aggregate only if chat-list profiling requires it.
			conversations: await Promise.all(
				conversations.map(async (conversation) => {
					const participant = conversation.participants.find(
						(item) => item.userId === userId,
					);
					if (!participant) return conversation;
					const lastReadMessage = participant.lastReadMessageId
						? messageCursors.get(participant.lastReadMessageId)
						: undefined;
					const [unreadCount, unreadMentionCount] = await Promise.all([
						this.repository.countUnreadMessages({
							conversationId: conversation.id,
							userId,
							joinedAt: participant.joinedAt,
							lastReadMessage,
						}),
						this.repository.countUnreadMessages({
							conversationId: conversation.id,
							userId,
							joinedAt: participant.joinedAt,
							lastReadMessage,
							mentionsOnly: true,
						}),
					]);
					return {
						...conversation,
						unreadCount,
						unreadMentionCount,
						messages: conversation.messages.map((message) =>
							this.toMessage(message, userId),
						),
					};
				}),
			),
			nextCursor:
				hasMore && lastConversation
					? this.encodeCursor({
							lastMessageAt: lastConversation.lastMessageAt,
							id: lastConversation.id,
						})
					: null,
		};
	}

	async createGroup(userId: string, name: string, initialInviteeIds: string[]) {
		const inviteeIds = [...new Set(initialInviteeIds)].filter(
			(id) => id !== userId,
		);
		if (!inviteeIds.length)
			throw new ChatError(
				"Select at least one other member",
				400,
				"CHAT_GROUP_INVITEE_REQUIRED",
			);
		const users = await this.repository.findUsersByIds(inviteeIds);
		if (users.length !== inviteeIds.length)
			throw new ChatError(
				"One or more invitees do not exist",
				404,
				"CHAT_MEMBER_NOT_FOUND",
			);
		const conversation = await this.repository.createGroup(
			name,
			userId,
			inviteeIds,
		);
		return {
			conversation,
			groupInvitations: conversation.groupInvitations,
		};
	}

	async inviteMember(actorId: string, conversationId: string, userId: string) {
		await this.requireGroupAuthority(conversationId, actorId, [
			"OWNER",
			"ADMIN",
		]);
		if (!(await this.repository.findUserById(userId)))
			throw new ChatError("Member not found", 404, "CHAT_MEMBER_NOT_FOUND");
		const member = await this.repository.findParticipant(
			conversationId,
			userId,
		);
		if (member && !member.leftAt)
			throw new ChatError(
				"Member is already in this group",
				409,
				"CHAT_MEMBER_ACTIVE",
			);
		const existing = await this.repository.findGroupInvitation(
			conversationId,
			userId,
		);
		if (existing?.status === "PENDING")
			return { invitation: existing, created: false };
		return {
			invitation: await this.repository.upsertGroupInvitation({
				conversationId,
				inviterId: actorId,
				inviteeId: userId,
			}),
			created: true,
		};
	}

	getGroupInvitations(userId: string) {
		return this.repository.listGroupInvitations(userId);
	}

	async acceptGroupInvitation(userId: string, invitationId: string) {
		const existing = await this.repository.findGroupInvitationForInvitee(
			invitationId,
			userId,
		);
		if (existing?.status !== "PENDING")
			throw new ChatError(
				"Group invitation is no longer pending",
				409,
				"CHAT_GROUP_INVITATION_NOT_PENDING",
			);
		const accepted = await this.repository.acceptGroupInvitation(
			invitationId,
			userId,
		);
		if (!accepted)
			throw new ChatError(
				"Group invitation is no longer pending",
				409,
				"CHAT_GROUP_INVITATION_NOT_PENDING",
			);
		return {
			...(await this.membershipChange(
				"member:added",
				accepted.invitation.conversationId,
				userId,
				accepted.member,
				"A member joined the group",
			)),
			invitation: accepted.invitation,
		};
	}

	async declineGroupInvitation(userId: string, invitationId: string) {
		const invitation = await this.repository.findGroupInvitationForInvitee(
			invitationId,
			userId,
		);
		if (invitation?.status !== "PENDING")
			throw new ChatError(
				"Group invitation is no longer pending",
				409,
				"CHAT_GROUP_INVITATION_NOT_PENDING",
			);
		const declined = await this.repository.declineGroupInvitation(
			invitationId,
			userId,
		);
		if (declined.count !== 1)
			throw new ChatError(
				"Group invitation is no longer pending",
				409,
				"CHAT_GROUP_INVITATION_NOT_PENDING",
			);
		return invitation;
	}

	async removeMember(actorId: string, conversationId: string, userId: string) {
		await this.requireGroupAuthority(conversationId, actorId, [
			"OWNER",
			"ADMIN",
		]);
		const member = await this.requireActiveMember(conversationId, userId);
		if (member.role === "OWNER")
			throw new ChatError(
				"Transfer ownership before removing the owner",
				409,
				"CHAT_OWNER_REMOVAL",
			);
		return this.membershipChange(
			"member:removed",
			conversationId,
			actorId,
			await this.repository.removeMember(conversationId, userId),
			"A member was removed from the group",
		);
	}

	async leaveGroup(userId: string, conversationId: string) {
		await this.requireGroupAuthority(conversationId, userId, [
			"OWNER",
			"ADMIN",
			"MEMBER",
		]);
		const member = await this.requireActiveMember(conversationId, userId);
		if (member.role === "OWNER")
			throw new ChatError(
				"Transfer ownership before leaving the group",
				409,
				"CHAT_OWNER_LEAVE",
			);
		return this.membershipChange(
			"member:left",
			conversationId,
			userId,
			await this.repository.removeMember(conversationId, userId),
			"A member left the group",
		);
	}

	async updateMemberRole(
		actorId: string,
		conversationId: string,
		userId: string,
		role: "ADMIN" | "MEMBER",
	) {
		await this.requireGroupAuthority(conversationId, actorId, ["OWNER"]);
		const member = await this.requireActiveMember(conversationId, userId);
		if (member.role === "OWNER")
			throw new ChatError(
				"Owner role cannot be changed",
				409,
				"CHAT_OWNER_ROLE",
			);
		return this.membershipChange(
			"member:role-updated",
			conversationId,
			actorId,
			await this.repository.updateMemberRole(conversationId, userId, role),
			"A member role changed",
		);
	}

	async transferOwnership(
		actorId: string,
		conversationId: string,
		userId: string,
	) {
		await this.requireGroupAuthority(conversationId, actorId, ["OWNER"]);
		if (actorId === userId)
			throw new ChatError(
				"Choose another member",
				400,
				"CHAT_OWNER_TRANSFER_SELF",
			);
		await this.requireActiveMember(conversationId, userId);
		return this.membershipChange(
			"member:ownership-transferred",
			conversationId,
			actorId,
			await this.repository.transferOwnership(conversationId, actorId, userId),
			"Group ownership was transferred",
		);
	}

	async getParticipantUserIds(conversationId: string) {
		return (
			await this.repository.findActiveParticipantUserIds(conversationId)
		).map(({ userId }) => userId);
	}

	async getMembershipAudienceUserIds(conversationId: string, userId: string) {
		return [
			...new Set([
				...(await this.getParticipantUserIds(conversationId)),
				userId,
			]),
		];
	}

	async getPresenceAudienceUserIds(userId: string) {
		return (await this.repository.findPresenceAudienceUserIds(userId))
			.map(({ userId: audienceUserId }) => audienceUserId)
			.filter((audienceUserId) => audienceUserId !== userId);
	}

	updateLastSeenAt(userId: string, lastSeenAt: Date) {
		return this.repository.updateLastSeenAt(userId, lastSeenAt);
	}

	async requireActiveParticipant(conversationId: string, userId: string) {
		const participant = await this.repository.findParticipant(
			conversationId,
			userId,
		);
		if (!participant?.conversation || participant.leftAt) {
			throw new ChatError(
				"You are not a participant in this conversation",
				403,
				"CHAT_NOT_PARTICIPANT",
			);
		}
		return participant;
	}

	private async requireEditableMessage(
		userId: string,
		messageId: string,
		checkEditWindow = true,
	) {
		const message = await this.repository.findMessage(messageId);
		if (!message || message.senderId !== userId || message.type !== "USER") {
			throw new ChatError("Message not found", 404, "CHAT_MESSAGE_NOT_FOUND");
		}
		if (message.deletedAt) {
			throw new ChatError("Message was deleted", 409, "CHAT_MESSAGE_DELETED");
		}
		if (
			checkEditWindow &&
			message.createdAt < new Date(Date.now() - 15 * 60_000)
		) {
			throw new ChatError(
				"Messages can only be edited for 15 minutes",
				409,
				"CHAT_EDIT_WINDOW",
			);
		}
		return message;
	}

	private async resolveReply(conversationId: string, messageId?: string) {
		if (!messageId) return null;
		const message = await this.repository.findMessage(messageId);
		if (!message || message.conversationId !== conversationId) {
			throw new ChatError(
				"Reply message not found",
				404,
				"CHAT_REPLY_NOT_FOUND",
			);
		}
		return {
			id: message.id,
			senderId: message.senderId,
			preview: message.deletedAt
				? "Message deleted"
				: message.text.slice(0, 240),
		};
	}

	private async validateAttachments(
		conversationId: string,
		userId: string,
		attachmentIds: string[],
	) {
		if (!attachmentIds.length) return;
		const attachments = await this.repository.findPendingAttachments(
			conversationId,
			userId,
			attachmentIds,
		);
		if (attachments.length !== attachmentIds.length) {
			throw new ChatError(
				"One or more attachments are unavailable",
				400,
				"CHAT_ATTACHMENT_INVALID",
			);
		}
	}

	private async validateMentions(
		participant: Awaited<ReturnType<ChatRepository["findParticipant"]>>,
		mentionUserIds: string[],
		mentionsEveryone: boolean,
	) {
		if (!mentionUserIds.length && !mentionsEveryone) return;
		if (participant?.conversation?.type !== "GROUP") {
			throw new ChatError(
				"Mentions require a group",
				409,
				"CHAT_MENTIONS_GROUP",
			);
		}
		if (
			mentionsEveryone &&
			participant.role !== "OWNER" &&
			participant.role !== "ADMIN"
		) {
			throw new ChatError(
				"Only owners and admins can mention everyone",
				403,
				"CHAT_MENTION_EVERYONE_FORBIDDEN",
			);
		}
		if (!mentionUserIds.length) return;
		const activeIds = new Set(
			await this.getParticipantUserIds(participant.conversationId),
		);
		if (mentionUserIds.some((userId) => !activeIds.has(userId))) {
			throw new ChatError(
				"Mentioned users must be active members",
				400,
				"CHAT_MENTION_INVALID",
			);
		}
	}

	private async requireActiveMember(conversationId: string, userId: string) {
		const member = await this.repository.findParticipant(
			conversationId,
			userId,
		);
		if (!member || member.leftAt)
			throw new ChatError(
				"Member is not active",
				404,
				"CHAT_MEMBER_NOT_ACTIVE",
			);
		return member;
	}

	private async membershipChange(
		action: string,
		conversationId: string,
		actorId: string,
		member: {
			userId: string;
			role: ConversationParticipantRole;
			joinedAt: Date;
			leftAt: Date | null;
			user: { id: string; firstName: string; lastName: string };
		},
		text: string,
	) {
		return {
			action,
			conversationId,
			actorId,
			member,
			message: this.toMessage(
				await this.repository.createSystemMessage(
					conversationId,
					actorId,
					text,
				),
				actorId,
			),
		};
	}

	private async requireGroupAuthority(
		conversationId: string,
		userId: string,
		allowedRoles: ConversationParticipantRole[],
	) {
		const participant = await this.requireActiveParticipant(
			conversationId,
			userId,
		);
		if (participant.conversation.type !== "GROUP") {
			throw new ChatError(
				"This action requires a group conversation",
				409,
				"CHAT_NOT_GROUP",
			);
		}
		if (!allowedRoles.includes(participant.role)) {
			throw new ChatError(
				"You do not have permission for this group action",
				403,
				"CHAT_GROUP_FORBIDDEN",
			);
		}
		return participant;
	}

	private toMessage(message: MessageDetails, viewerId: string) {
		const reactions = new Map<
			string,
			{ emoji: string; count: number; reactedByMe: boolean }
		>();
		for (const reaction of message.reactions) {
			const summary = reactions.get(reaction.emoji) ?? {
				emoji: reaction.emoji,
				count: 0,
				reactedByMe: false,
			};
			summary.count += 1;
			summary.reactedByMe ||= reaction.userId === viewerId;
			reactions.set(reaction.emoji, summary);
		}
		return {
			id: message.id,
			conversationId: message.conversationId,
			senderId: message.senderId,
			clientMessageId: message.clientMessageId,
			type: message.type,
			text: message.deletedAt ? "Message deleted" : message.text,
			createdAt: message.createdAt,
			editedAt: message.editedAt,
			deletedAt: message.deletedAt,
			replyTo: message.replyToId
				? {
						messageId: message.replyToId,
						text: message.replyPreview,
						senderId: message.replySenderId,
					}
				: null,
			attachments: message.deletedAt
				? []
				: message.attachments.map((attachment) => ({
						...attachment,
						url: `/api/storage/objects/${attachment.key
							.split("/")
							.map((segment) => encodeURIComponent(segment))
							.join("/")}`,
					})),
			mentionUserIds: message.deletedAt
				? []
				: message.mentions.map(({ userId }) => userId),
			mentionsEveryone: !message.deletedAt && message.mentionsEveryone,
			reactions: message.deletedAt ? [] : [...reactions.values()],
		};
	}

	private encodeCursor(cursor: Record<string, Date | string>) {
		return Buffer.from(
			JSON.stringify(
				Object.fromEntries(
					Object.entries(cursor).map(([key, value]) => [
						key,
						value instanceof Date ? value.toISOString() : value,
					]),
				),
			),
		).toString("base64url");
	}

	private decodeCursor(
		value: string | undefined,
		kind: "message" | "conversation",
	) {
		if (!value) return null;
		try {
			const parsed = JSON.parse(
				Buffer.from(value, "base64url").toString("utf8"),
			) as Record<string, string>;
			const timestampKey = kind === "message" ? "createdAt" : "lastMessageAt";
			const timestamp = new Date(parsed[timestampKey] ?? "");
			if (!parsed.id || Number.isNaN(timestamp.getTime()))
				throw new Error("invalid cursor");
			return { id: parsed.id, [timestampKey]: timestamp };
		} catch {
			throw new ChatError("Invalid cursor", 400, "CHAT_INVALID_CURSOR");
		}
	}
}
