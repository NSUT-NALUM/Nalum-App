import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import ForbiddenError from "../../errors/forbidden.error";
import { getCurrentUser, protect } from "../../middlewares/auth.middleware";
import { UnsupportedStorageObjectKeyError } from "./storage.errors";
import {
	isAllowedStorageObjectKey,
	isChatImageObjectKey,
	isPostImageObjectKey,
	toStorageObjectUrl,
} from "./storage.keys";

type StorageObjectParams = {
	"*": string;
};

const storageRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get<{ Params: StorageObjectParams }>(
		"/objects/*",
		{
			preHandler: protect,
			schema: {
				summary: "Read protected storage object",
				description:
					"Streams an authenticated object from private S3-compatible storage.",
				tags: ["Storage"],
				security: [{ bearerAuth: [] }],
			},
		},
		streamStorageObject,
	);

	async function streamStorageObject(
		request: FastifyRequest<{ Params: StorageObjectParams }>,
		reply: FastifyReply,
	) {
		const key = request.params["*"];
		if (!isAllowedStorageObjectKey(key)) {
			throw new UnsupportedStorageObjectKeyError();
		}
		if (isChatImageObjectKey(key)) {
			const attachment =
				await request.server.prisma.messageAttachment.findFirst({
					where: {
						key,
						message: {
							is: {
								deletedAt: null,
								conversation: {
									participants: {
										some: {
											userId: getCurrentUser(request).id,
											leftAt: null,
										},
									},
								},
							},
						},
					},
					select: { id: true },
				});
			if (!attachment)
				throw new ForbiddenError(
					"You cannot access this chat attachment",
					"CHAT_ATTACHMENT_FORBIDDEN",
				);
		}
		if (isPostImageObjectKey(key)) {
			const user = getCurrentUser(request);
			const post = await request.server.prisma.post.findFirst({
				where: {
					imageKeys: { has: key },
					...(user.role === "ADMIN"
						? {}
						: { OR: [{ status: "PUBLISHED" }, { authorId: user.id }] }),
				},
				select: { id: true },
			});
			if (!post)
				throw new ForbiddenError(
					"You cannot access this post image",
					"POST_IMAGE_FORBIDDEN",
				);
		}

		const object = await request.server.storage.getObjectStream(key);

		if (object.contentType) {
			reply.header("content-type", object.contentType);
		}
		reply.header("cache-control", "private, max-age=300");

		return reply.send(object.body);
	}
};

export { toStorageObjectUrl };
export default storageRoutes;
