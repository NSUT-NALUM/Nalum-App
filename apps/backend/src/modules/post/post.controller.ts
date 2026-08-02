import type { FastifyReply, FastifyRequest } from "fastify";
import BadRequestError from "../../errors/bad-request.error";
import { getCurrentUser } from "../../middlewares/auth.middleware";
import { POST_IMAGE_UPLOAD_PREFIX } from "../storage/storage.keys";
import {
	type CommentIdParams,
	type ContentReportIdParams,
	type ContentReportInput,
	type ContentReportsQuery,
	commentSchema,
	commentUpdateSchema,
	type ModerationPostsQuery,
	type PostFields,
	type PostIdParams,
	type PostModerationNote,
	type PostPageQuery,
	type PostRejectionInput,
	type PostVoteInput,
	postFieldsSchema,
	postUpdateFieldsSchema,
} from "./post.schema";
import type { PostService } from "./post.service";

export class PostController {
	constructor(private readonly service: PostService) {}

	create = async (request: FastifyRequest, reply: FastifyReply) => {
		const actor = getCurrentUser(request);
		const postId = crypto.randomUUID();
		const { fields, imageKeys } = await this.readMultipart(request, postId);
		const input = postFieldsSchema.parse(fields);
		return reply.success(
			await this.service.createPost(
				{
					...input,
					id: postId,
					authorId: actor.id,
					imageKeys,
					status: actor.role === "ADMIN" ? "PUBLISHED" : "PENDING",
				},
				actor,
			),
			"Post created successfully",
			201,
		);
	};

	list = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.listPublishedPosts(
				request.query as PostPageQuery,
				getCurrentUser(request).id,
			),
		);

	mine = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.listMyPosts(
				getCurrentUser(request),
				request.query as PostPageQuery,
			),
		);

	get = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.getPost(
				(request.params as PostIdParams).postId,
				getCurrentUser(request),
			),
		);

	update = async (request: FastifyRequest, reply: FastifyReply) => {
		const postId = (request.params as PostIdParams).postId;
		const { fields, imageKeys, hasImages } = await this.readMultipart(
			request,
			postId,
		);
		const input = postUpdateFieldsSchema.parse(fields);
		return reply.success(
			await this.service.updatePost(
				postId,
				hasImages ? { ...input, imageKeys } : input,
				getCurrentUser(request),
			),
			"Post updated successfully",
		);
	};

	listComments = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.listComments(
				(request.params as PostIdParams).postId,
				request.query as PostPageQuery,
				getCurrentUser(request),
			),
		);

	createComment = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.createComment(
				(request.params as PostIdParams).postId,
				commentSchema.parse(request.body),
				getCurrentUser(request),
			),
			"Comment created successfully",
			201,
		);

	updateComment = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.updateComment(
				(request.params as CommentIdParams).commentId,
				commentUpdateSchema.parse(request.body),
				getCurrentUser(request),
			),
			"Comment updated successfully",
		);

	setPostVote = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.setPostVote(
				(request.params as PostIdParams).postId,
				(request.body as PostVoteInput).direction,
				getCurrentUser(request),
			),
		);

	removePostVote = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.removePostVote(
				(request.params as PostIdParams).postId,
				getCurrentUser(request),
			),
		);

	setCommentVote = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.setCommentVote(
				(request.params as CommentIdParams).commentId,
				(request.body as PostVoteInput).direction,
				getCurrentUser(request),
			),
		);

	removeCommentVote = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.removeCommentVote(
				(request.params as CommentIdParams).commentId,
				getCurrentUser(request),
			),
		);

	reportPost = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.reportPost(
				(request.params as PostIdParams).postId,
				(request.body as ContentReportInput).reason,
				getCurrentUser(request),
			),
			"Post reported successfully",
			201,
		);

	reportComment = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.reportComment(
				(request.params as CommentIdParams).commentId,
				(request.body as ContentReportInput).reason,
				getCurrentUser(request),
			),
			"Comment reported successfully",
			201,
		);

	moderationList = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.listPostsForModeration(
				request.query as ModerationPostsQuery,
				getCurrentUser(request),
			),
		);

	approve = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.approvePost(
				(request.params as PostIdParams).postId,
				getCurrentUser(request),
				(request.body as PostModerationNote).note,
			),
			"Post approved successfully",
		);

	reject = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.rejectPost(
				(request.params as PostIdParams).postId,
				getCurrentUser(request),
				(request.body as PostRejectionInput).reason,
			),
			"Post rejected successfully",
		);

	listReports = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.listReports(
				request.query as ContentReportsQuery,
				getCurrentUser(request),
			),
		);

	dismissReport = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.dismissReport(
				(request.params as ContentReportIdParams).reportId,
				getCurrentUser(request),
			),
			"Report dismissed successfully",
		);

	removeReportedContent = async (
		request: FastifyRequest,
		reply: FastifyReply,
	) =>
		reply.success(
			await this.service.removeReportedContent(
				(request.params as ContentReportIdParams).reportId,
				getCurrentUser(request),
			),
			"Reported content removed successfully",
		);

	private async readMultipart(request: FastifyRequest, postId: string) {
		if (!request.isMultipart()) {
			throw new BadRequestError(
				"Multipart request expected",
				"MULTIPART_REQUIRED",
			);
		}
		const fields: Partial<Record<keyof PostFields, string>> = {};
		const imageKeys: string[] = [];
		let hasImages = false;
		for await (const part of request.parts()) {
			if (part.type === "file") {
				if (part.fieldname !== "images" && part.fieldname !== "images[]")
					continue;
				hasImages = true;
				if (imageKeys.length === 10) {
					throw new BadRequestError(
						"A maximum of 10 post images is allowed",
						"TOO_MANY_POST_IMAGES",
					);
				}
				const upload = await request.server.storage.uploadImage(
					{
						filename: part.filename,
						mimetype: part.mimetype,
						toBuffer: async () => part.toBuffer(),
					},
					[POST_IMAGE_UPLOAD_PREFIX, postId],
					{ maxInputBytes: 5 * 1024 * 1024, maxOutputBytes: 5 * 1024 * 1024 },
				);
				imageKeys.push(upload.key);
			} else if (part.fieldname in postFieldsSchema.shape) {
				fields[part.fieldname as keyof PostFields] = part.value as string;
			}
		}
		return { fields, imageKeys, hasImages };
	}
}
