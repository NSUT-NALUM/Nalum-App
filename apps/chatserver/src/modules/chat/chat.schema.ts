import { z } from "zod/v4";

export const directConversationSchema = z.object({ recipientUserId: z.uuid() });
export const connectionRequestSchema = z.object({
	recipientUserId: z.uuid(),
	text: z.string().trim().min(1).max(4000),
});
export const groupConversationSchema = z.object({
	name: z.string().trim().min(1).max(120),
	inviteeIds: z.array(z.uuid()).min(1).max(250),
});
const memberIdsSchema = z
	.array(z.uuid())
	.max(250)
	.refine((ids) => new Set(ids).size === ids.length);
const messageFieldsSchema = z.object({
	text: z.string().trim().max(4000).default(""),
	attachmentIds: z.array(z.uuid()).max(10).default([]),
	replyToId: z.uuid().optional(),
	mentionUserIds: memberIdsSchema.default([]),
	mentionsEveryone: z.boolean().default(false),
});
export const messageSendSchema = messageFieldsSchema
	.extend({ conversationId: z.uuid(), clientMessageId: z.uuid() })
	.refine(
		({ text, attachmentIds }) => Boolean(text) || attachmentIds.length > 0,
		"A message needs text or an attachment",
	);
export const messageEditSchema = z.object({
	messageId: z.uuid(),
	text: z.string().trim().min(1).max(4000),
	mentionUserIds: memberIdsSchema.default([]),
	mentionsEveryone: z.boolean().default(false),
});
export const messageDeleteSchema = z.object({ messageId: z.uuid() });
export const reactionToggleSchema = z.object({
	messageId: z.uuid(),
	emoji: z.string().trim().min(1).max(16),
});
export const receiptReadSchema = z.object({
	conversationId: z.uuid(),
	messageId: z.uuid(),
});
export const typingStartSchema = z.object({ conversationId: z.uuid() });
export const cursorQuerySchema = z.object({
	cursor: z.string().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const groupInvitationSchema = z.object({ userId: z.uuid() });
export const memberParamsSchema = z.object({
	conversationId: z.uuid(),
	userId: z.uuid(),
});
export const roleSchema = z.object({ role: z.enum(["ADMIN", "MEMBER"]) });
export const conversationParamsSchema = z.object({ conversationId: z.uuid() });
export const connectionRequestParamsSchema = z.object({ requestId: z.uuid() });
export const groupInvitationParamsSchema = z.object({ invitationId: z.uuid() });

export type MessageSendInput = z.infer<typeof messageSendSchema>;
export type MessageEditInput = z.infer<typeof messageEditSchema>;
