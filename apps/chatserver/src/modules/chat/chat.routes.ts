import type { FastifyInstance, FastifyRequest } from "fastify";
import { ChatError } from "./chat.errors";
import {
	connectionRequestParamsSchema,
	connectionRequestSchema,
	conversationParamsSchema,
	cursorQuerySchema,
	directConversationSchema,
	groupConversationSchema,
	groupInvitationParamsSchema,
	groupInvitationSchema,
	memberParamsSchema,
	roleSchema,
} from "./chat.schema";
import type { ChatService } from "./chat.service";

type Authenticate = (request: FastifyRequest) => Promise<void>;
type MembershipChange = Awaited<ReturnType<ChatService["removeMember"]>>;
const chatUserId = (request: FastifyRequest) => {
	if (!request.chatUserId)
		throw new ChatError("Authentication required", 401, "CHAT_AUTH_REQUIRED");
	return request.chatUserId;
};

export const registerChatRoutes = async (
	app: FastifyInstance,
	service: ChatService,
	authenticate: Authenticate,
	notify: (userIds: string[], message: unknown) => Promise<unknown>,
) => {
	const notifyMembershipChange = async (change: MembershipChange) => {
		const audience = await service.getMembershipAudienceUserIds(
			change.conversationId,
			change.member.userId,
		);
		await Promise.all([
			notify(audience, {
				type: "conversation:membership-updated",
				payload: change,
			}),
			notify(audience, { type: "message:new", payload: change.message }),
		]);
	};
	const notifyInvitation = async (
		userIds: string[],
		invitation: unknown,
		type: "group-invitation:new" | "group-invitation:updated",
	) => notify(userIds, { type, payload: invitation });
	app.post(
		"/api/conversations/direct",
		{ preValidation: authenticate },
		async (request) => {
			const input = directConversationSchema.parse(request.body);
			return service.createDirectConversation(
				chatUserId(request),
				input.recipientUserId,
			);
		},
	);

	app.post(
		"/api/connection-requests",
		{ preValidation: authenticate },
		async (request) => {
			const input = connectionRequestSchema.parse(request.body);
			const connectionRequest = await service.createConnectionRequest(
				chatUserId(request),
				input.recipientUserId,
				input.text,
			);
			await notify([connectionRequest.recipientId], {
				type: "connection-request:new",
				payload: { id: connectionRequest.id },
			});
			return connectionRequest;
		},
	);

	app.get(
		"/api/connection-requests/:direction",
		{ preValidation: authenticate },
		async (request) => {
			const { direction } = request.params as {
				direction: "incoming" | "outgoing";
			};
			if (direction !== "incoming" && direction !== "outgoing")
				throw new ChatError(
					"Invalid request direction",
					400,
					"CHAT_VALIDATION",
				);
			return service.getConnectionRequests(chatUserId(request), direction);
		},
	);

	app.post(
		"/api/connection-requests/:requestId/accept",
		{ preValidation: authenticate },
		async (request) => {
			const { requestId } = connectionRequestParamsSchema.parse(request.params);
			const result = await service.acceptConnectionRequest(
				chatUserId(request),
				requestId,
			);
			await notify([result.request.requesterId, result.request.recipientId], {
				type: "connection-request:updated",
				payload: {
					id: result.request.id,
					conversationId: result.conversation.id,
				},
			});
			return result;
		},
	);

	app.post(
		"/api/connection-requests/:requestId/decline",
		{ preValidation: authenticate },
		async (request) => {
			const { requestId } = connectionRequestParamsSchema.parse(request.params);
			const connectionRequest = await service.declineConnectionRequest(
				chatUserId(request),
				requestId,
			);
			await notify(
				[connectionRequest.requesterId, connectionRequest.recipientId],
				{
					type: "connection-request:updated",
					payload: { id: requestId },
				},
			);
			return { success: true };
		},
	);

	app.get(
		"/api/conversations",
		{ preValidation: authenticate },
		async (request) => {
			const query = cursorQuerySchema.parse(request.query);
			return service.getConversations(
				chatUserId(request),
				query.cursor,
				query.limit,
			);
		},
	);

	app.get(
		"/api/conversations/:conversationId/messages",
		{ preValidation: authenticate },
		async (request) => {
			const { conversationId } = conversationParamsSchema.parse(request.params);
			const query = cursorQuerySchema.parse(request.query);
			return service.getMessages(
				chatUserId(request),
				conversationId,
				query.cursor,
				query.limit,
			);
		},
	);

	app.post(
		"/api/conversations/groups",
		{ preValidation: authenticate },
		async (request) => {
			const input = groupConversationSchema.parse(request.body);
			const group = await service.createGroup(
				chatUserId(request),
				input.name,
				input.inviteeIds,
			);
			await Promise.all(
				group.groupInvitations.map((invitation) =>
					notifyInvitation(
						[invitation.inviteeId],
						invitation,
						"group-invitation:new",
					),
				),
			);
			return group.conversation;
		},
	);

	app.get(
		"/api/group-invitations/incoming",
		{ preValidation: authenticate },
		async (request) => service.getGroupInvitations(chatUserId(request)),
	);

	app.post(
		"/api/group-invitations/:invitationId/accept",
		{ preValidation: authenticate },
		async (request) => {
			const { invitationId } = groupInvitationParamsSchema.parse(
				request.params,
			);
			const change = await service.acceptGroupInvitation(
				chatUserId(request),
				invitationId,
			);
			await Promise.all([
				notifyMembershipChange(change),
				notifyInvitation(
					[change.invitation.inviterId, change.invitation.inviteeId],
					{ ...change.invitation, status: "ACCEPTED" },
					"group-invitation:updated",
				),
			]);
			return change.member;
		},
	);

	app.post(
		"/api/group-invitations/:invitationId/decline",
		{ preValidation: authenticate },
		async (request) => {
			const { invitationId } = groupInvitationParamsSchema.parse(
				request.params,
			);
			const invitation = await service.declineGroupInvitation(
				chatUserId(request),
				invitationId,
			);
			await notifyInvitation(
				[invitation.inviterId, invitation.inviteeId],
				{ ...invitation, status: "DECLINED" },
				"group-invitation:updated",
			);
			return { success: true };
		},
	);

	app.post(
		"/api/conversations/:conversationId/invitations",
		{ preValidation: authenticate },
		async (request) => {
			const { conversationId } = conversationParamsSchema.parse(request.params);
			const { userId } = groupInvitationSchema.parse(request.body);
			const result = await service.inviteMember(
				chatUserId(request),
				conversationId,
				userId,
			);
			if (result.created)
				await notifyInvitation(
					[result.invitation.inviteeId],
					result.invitation,
					"group-invitation:new",
				);
			return result.invitation;
		},
	);

	app.delete(
		"/api/conversations/:conversationId/members/:userId",
		{ preValidation: authenticate },
		async (request) => {
			const { conversationId, userId } = memberParamsSchema.parse(
				request.params,
			);
			const change = await service.removeMember(
				chatUserId(request),
				conversationId,
				userId,
			);
			await notifyMembershipChange(change);
			return { success: true };
		},
	);

	app.post(
		"/api/conversations/:conversationId/leave",
		{ preValidation: authenticate },
		async (request) => {
			const { conversationId } = conversationParamsSchema.parse(request.params);
			const change = await service.leaveGroup(
				chatUserId(request),
				conversationId,
			);
			await notifyMembershipChange(change);
			return { success: true };
		},
	);

	app.patch(
		"/api/conversations/:conversationId/members/:userId/role",
		{ preValidation: authenticate },
		async (request) => {
			const { conversationId, userId } = memberParamsSchema.parse(
				request.params,
			);
			const { role } = roleSchema.parse(request.body);
			const change = await service.updateMemberRole(
				chatUserId(request),
				conversationId,
				userId,
				role,
			);
			await notifyMembershipChange(change);
			return change.member;
		},
	);

	app.post(
		"/api/conversations/:conversationId/members/:userId/ownership",
		{ preValidation: authenticate },
		async (request) => {
			const { conversationId, userId } = memberParamsSchema.parse(
				request.params,
			);
			const change = await service.transferOwnership(
				chatUserId(request),
				conversationId,
				userId,
			);
			await notifyMembershipChange(change);
			return change.member;
		},
	);
};
