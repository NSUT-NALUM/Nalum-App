import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { createPrismaClient } from "@nalum/database/client";
import type { FastifyServerOptions } from "fastify";
import Fastify from "fastify";
import { env } from "./config/env.config";
import { ChatError } from "./modules/chat/chat.errors";
import { ChatRepository } from "./modules/chat/chat.repository";
import { registerChatRoutes } from "./modules/chat/chat.routes";
import {
	messageDeleteSchema,
	messageEditSchema,
	messageSendSchema,
	reactionToggleSchema,
	receiptReadSchema,
	typingStartSchema,
} from "./modules/chat/chat.schema";
import { ChatService } from "./modules/chat/chat.service";
import { ConnectionRegistry } from "./realtime/connection.registry";
import { PresenceService } from "./realtime/presence.service";
import { RedisFanout } from "./realtime/redis.fanout";

type AccessTokenPayload = {
	sub: string;
	tokenType: "access";
};

declare module "fastify" {
	interface FastifyRequest {
		chatUserId?: string;
	}
}

const CHAT_PROTOCOL = "nalum.chat.v1";

export const buildApp = async (options: FastifyServerOptions = {}) => {
	const app = Fastify({ logger: true, ...options });
	const prisma = createPrismaClient(env.DATABASE_URL);
	const registry = new ConnectionRegistry();
	const fanout = new RedisFanout(env.REDIS_URL, registry);
	const chatRepository = new ChatRepository(prisma);
	const chatService = new ChatService(chatRepository);
	const presence = new PresenceService(env.REDIS_URL);
	const allowedOrigins = env.CHAT_CORS_ORIGIN.split(",").map((origin) =>
		origin.trim(),
	);
	const isAllowedOrigin = (origin: string | undefined) =>
		!origin || allowedOrigins.includes(origin);
	const publishToUsers = async (userIds: string[], message: unknown) =>
		Promise.all(userIds.map((userId) => fanout.publish({ userId, message })));

	await fanout.connect();
	await app.register(cors, {
		credentials: true,
		origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
	});
	await presence.connect(
		async (userId, lastSeenAt) => {
			await chatService.updateLastSeenAt(userId, lastSeenAt);
			await publishToUsers(
				await chatService.getPresenceAudienceUserIds(userId),
				{
					type: "presence:update",
					payload: {
						userId,
						status: "offline",
						lastSeenAt: lastSeenAt.toISOString(),
					},
				},
			);
		},
		async (conversationId, userId) => {
			await publishToUsers(
				(await chatService.getParticipantUserIds(conversationId)).filter(
					(participantId) => participantId !== userId,
				),
				{
					type: "typing:update",
					payload: { conversationId, userId, isTyping: false },
				},
			);
		},
	);
	await app.register(jwt, { secret: env.JWT_SECRET });
	await app.register(websocket, { options: { maxPayload: 16 * 1024 } });

	const authenticate = async (
		request: import("fastify").FastifyRequest,
		token: string,
	) => {
		let payload: AccessTokenPayload;
		try {
			payload = request.server.jwt.verify<AccessTokenPayload>(token);
		} catch {
			throw new ChatError("Authentication required", 401, "CHAT_AUTH_REQUIRED");
		}
		if (payload.tokenType !== "access")
			throw new ChatError(
				"Access token is required",
				401,
				"CHAT_ACCESS_TOKEN_REQUIRED",
			);
		const user = await prisma.user.findUnique({
			where: { id: payload.sub },
			include: {
				bans: {
					where: {
						revokedAt: null,
						OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
					},
				},
			},
		});
		if (!user)
			throw new ChatError(
				"User is not allowed to connect",
				401,
				"CHAT_USER_NOT_ALLOWED",
			);
		if (user.bans.length > 0) {
			throw new ChatError(
				"User is banned from the platform",
				403,
				"USER_BANNED",
			);
		}
		if (user.role === "ALUMNI" && user.verificationStatus !== "VERIFIED") {
			throw new ChatError(
				user.verificationStatus === "REJECTED"
					? "Alumni application was rejected"
					: "Alumni application is pending",
				403,
				user.verificationStatus === "REJECTED"
					? "ALUMNI_VERIFICATION_REJECTED"
					: "ALUMNI_VERIFICATION_PENDING",
			);
		}
		request.chatUserId = user.id;
	};

	const authenticateHttp = async (
		request: import("fastify").FastifyRequest,
	) => {
		const authorization = request.headers.authorization;
		const token = authorization?.startsWith("Bearer ")
			? authorization.slice(7)
			: undefined;
		if (!token)
			throw new ChatError("Authentication required", 401, "CHAT_AUTH_REQUIRED");
		await authenticate(request, token);
	};

	app.setErrorHandler((error, _request, reply) => {
		if (error instanceof ChatError)
			return reply
				.code(error.statusCode)
				.send({ success: false, code: error.code, message: error.message });
		if (error instanceof Error && error.name === "ZodError")
			return reply.code(400).send({
				success: false,
				code: "CHAT_VALIDATION",
				message: "Invalid request payload",
			});
		app.log.error(error);
		return reply.code(500).send({
			success: false,
			code: "CHAT_INTERNAL",
			message: "Internal server error",
		});
	});

	app.get("/api/health", async () => {
		await prisma.$queryRaw`SELECT 1`;
		return { status: "OK", service: "chatserver" };
	});

	await registerChatRoutes(app, chatService, authenticateHttp, publishToUsers);

	app.get(
		"/ws",
		{
			websocket: true,
			preValidation: async (request) => {
				if (!isAllowedOrigin(request.headers.origin)) {
					throw new ChatError(
						"Origin is not allowed",
						403,
						"CHAT_ORIGIN_FORBIDDEN",
					);
				}
				const protocols = request.headers["sec-websocket-protocol"]
					?.split(",")
					.map((value) => value.trim())
					.filter(Boolean);
				const accessToken = protocols?.find((value) => value !== CHAT_PROTOCOL);
				if (!protocols?.includes(CHAT_PROTOCOL) || !accessToken) {
					throw new Error("WebSocket authentication protocol is required");
				}

				await authenticate(request, accessToken);
			},
		},
		(socket, request) => {
			const userId = request.chatUserId;
			if (!userId) {
				socket.close(4003, "Authentication required");
				return;
			}
			const connectionId = crypto.randomUUID();
			registry.add(userId, socket);
			void presence
				.heartbeat(userId, connectionId)
				.then(async (becameOnline) => {
					if (becameOnline) {
						await publishToUsers(
							await chatService.getPresenceAudienceUserIds(userId),
							{
								type: "presence:update",
								payload: { userId, status: "online" },
							},
						);
					}
				});
			socket.send(
				JSON.stringify({
					type: "socket:ack",
					payload: {
						connectionId,
						userId,
						serverTime: new Date().toISOString(),
					},
				}),
			);
			socket.on("message", (rawMessage: Buffer) => {
				void (async () => {
					try {
						if (!(await chatRepository.findUserById(userId))) {
							registry.disconnect(userId);
							return;
						}
						const event = JSON.parse(rawMessage.toString()) as {
							type?: string;
							payload?: unknown;
						};
						if (event.type === "message:send") {
							const input = messageSendSchema.parse(event.payload);
							const { message, created } = await chatService.sendMessage(
								userId,
								input,
							);
							socket.send(
								JSON.stringify({ type: "message:accepted", payload: message }),
							);
							if (created) {
								const participantIds = await chatService.getParticipantUserIds(
									input.conversationId,
								);
								await publishToUsers(participantIds, {
									type: "message:new",
									payload: message,
								});
								const mentionIds = input.mentionsEveryone
									? participantIds.filter(
											(participantId) => participantId !== userId,
										)
									: input.mentionUserIds.filter(
											(mentionId) => mentionId !== userId,
										);
								if (mentionIds.length)
									await publishToUsers(mentionIds, {
										type: "message:mention",
										payload: {
											conversationId: input.conversationId,
											messageId: message.id,
										},
									});
							}
							return;
						}
						if (event.type === "message:edit") {
							const input = messageEditSchema.parse(event.payload);
							const message = await chatService.editMessage(userId, input);
							await publishToUsers(
								await chatService.getParticipantUserIds(message.conversationId),
								{ type: "message:updated", payload: message },
							);
							return;
						}
						if (event.type === "message:delete") {
							const { messageId } = messageDeleteSchema.parse(event.payload);
							const message = await chatService.deleteMessage(
								userId,
								messageId,
							);
							await publishToUsers(
								await chatService.getParticipantUserIds(message.conversationId),
								{ type: "message:deleted", payload: message },
							);
							return;
						}
						if (event.type === "reaction:toggle") {
							const { messageId, emoji } = reactionToggleSchema.parse(
								event.payload,
							);
							const reaction = await chatService.toggleReaction(
								userId,
								messageId,
								emoji,
							);
							await publishToUsers(
								await chatService.getParticipantUserIds(
									reaction.conversationId,
								),
								{ type: "reaction:updated", payload: reaction },
							);
							return;
						}
						if (event.type === "receipt:read") {
							const { conversationId, messageId } = receiptReadSchema.parse(
								event.payload,
							);
							const receipt = await chatService.markRead(
								userId,
								conversationId,
								messageId,
							);
							await publishToUsers(
								await chatService.getParticipantUserIds(conversationId),
								{
									type: "receipt:updated",
									payload: { conversationId, ...receipt },
								},
							);
							return;
						}
						if (event.type === "presence:heartbeat") {
							const becameOnline = await presence.heartbeat(
								userId,
								connectionId,
							);
							if (becameOnline)
								await publishToUsers(
									await chatService.getPresenceAudienceUserIds(userId),
									{
										type: "presence:update",
										payload: { userId, status: "online" },
									},
								);
							return;
						}
						if (event.type === "typing:start") {
							const { conversationId } = typingStartSchema.parse(event.payload);
							await chatService.requireActiveParticipant(
								conversationId,
								userId,
							);
							await presence.startTyping(conversationId, userId);
							await publishToUsers(
								(
									await chatService.getParticipantUserIds(conversationId)
								).filter((participantId) => participantId !== userId),
								{
									type: "typing:update",
									payload: { conversationId, userId, isTyping: true },
								},
							);
							return;
						}
						throw new ChatError(
							"Unknown socket event",
							400,
							"CHAT_UNKNOWN_EVENT",
						);
					} catch (error) {
						const chatError =
							error instanceof ChatError
								? error
								: new ChatError(
										"Invalid socket payload",
										400,
										"CHAT_VALIDATION",
									);
						socket.send(
							JSON.stringify({
								type: "error",
								payload: { code: chatError.code, message: chatError.message },
							}),
						);
					}
				})();
			});
			socket.on("close", () => {
				registry.remove(userId, socket);
				void presence
					.disconnect(userId, connectionId)
					.then(async (becameOffline) => {
						if (!becameOffline) return;
						const lastSeenAt = new Date();
						await chatService.updateLastSeenAt(userId, lastSeenAt);
						await publishToUsers(
							await chatService.getPresenceAudienceUserIds(userId),
							{
								type: "presence:update",
								payload: {
									userId,
									status: "offline",
									lastSeenAt: lastSeenAt.toISOString(),
								},
							},
						);
					});
			});
		},
	);

	app.addHook("onClose", async () => {
		await presence.close();
		await fanout.close();
		await prisma.$disconnect();
	});

	return app;
};
