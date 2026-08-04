import type { FastifyPluginAsync } from "fastify";
import { z } from "zod/v4";
import BadRequestError from "../../errors/bad-request.error";
import ForbiddenError from "../../errors/forbidden.error";
import {
	getCurrentUser,
	requirePlatformAccess,
} from "../../middlewares/auth.middleware";
import {
	CHAT_IMAGE_UPLOAD_PREFIX,
	toStorageObjectUrl,
} from "../storage/storage.keys";

const maxImageBytes = 5 * 1024 * 1024;
const querySchema = z.object({ conversationId: z.uuid() });

const chatAttachmentRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.post(
		"/attachments",
		{ preHandler: requirePlatformAccess },
		async (request, reply) => {
			if (!request.isMultipart())
				throw new BadRequestError(
					"Multipart request expected",
					"MULTIPART_REQUIRED",
				);
			const { conversationId } = querySchema.parse(request.query);
			const userId = getCurrentUser(request).id;
			const participant =
				await fastify.prisma.conversationParticipant.findFirst({
					where: { conversationId, userId, leftAt: null },
					select: { conversationId: true },
				});
			if (!participant)
				throw new ForbiddenError(
					"You are not a participant in this conversation",
					"CHAT_NOT_PARTICIPANT",
				);
			const file = await request.file();
			if (file?.fieldname !== "image")
				throw new BadRequestError(
					"An image file is required",
					"CHAT_IMAGE_REQUIRED",
				);

			const uploaded = await fastify.storage.uploadImage(
				{
					filename: file.filename,
					mimetype: file.mimetype,
					toBuffer: async () => file.toBuffer(),
				},
				[CHAT_IMAGE_UPLOAD_PREFIX, conversationId, userId],
				{ maxInputBytes: maxImageBytes, maxOutputBytes: maxImageBytes },
			);
			const attachment = await fastify.prisma.messageAttachment.create({
				data: {
					conversationId,
					ownerId: userId,
					key: uploaded.key,
					contentType: uploaded.contentType,
				},
			});
			return reply.success({
				id: attachment.id,
				key: attachment.key,
				contentType: attachment.contentType,
				url: toStorageObjectUrl(attachment.key),
			});
		},
	);
};

export default chatAttachmentRoutes;
