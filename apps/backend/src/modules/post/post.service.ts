import { env } from "../../config/env.config";
import type { VoteDirection } from "../../database/prisma/generated/client";
import { enqueueEmail } from "../../queues/email.queue";
import { toStorageObjectUrl } from "../storage/storage.keys";
import {
	CommentNotFoundError,
	ContentReportConflictError,
	PostForbiddenError,
	PostNotFoundError,
	PostReplyDepthError,
	PostStateConflictError,
} from "./post.errors";
import type { PostRepository } from "./post.repository";
import type {
	CommentInput,
	CommentUpdate,
	ContentReportsQuery,
	ModerationPostsQuery,
	PostPageQuery,
	PostUpdateFields,
} from "./post.schema";
import type { PostActor, PostCreateInput, PostVoteSummary } from "./post.types";

type Person = { id: string; firstName: string; lastName: string };
type PostView = {
	id: string;
	title: string;
	body: string;
	authorId: string;
	reviewerId: string | null;
	status: "PENDING" | "PUBLISHED" | "REJECTED" | "REMOVED";
	imageKeys: string[];
	moderationNote: string | null;
	rejectionReason: string | null;
	removedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	author: Person;
	reviewer: Person | null;
	votes: Array<{ direction: VoteDirection }>;
	_count: { comments: number };
};
type CommentView = {
	id: string;
	postId: string;
	parentId: string | null;
	authorId: string;
	body: string;
	editedAt: Date | null;
	removedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	author: Person;
	votes: Array<{ direction: VoteDirection }>;
};
type CommentThreadView = CommentView & { replies: CommentView[] };
type CommentOutput = Omit<CommentView, "body" | "removedAt" | "votes"> & {
	body: string | null;
	isRemoved: boolean;
	upvotes: number;
	downvotes: number;
	score: number;
	myVote: VoteDirection | null;
	replies: CommentOutput[];
};

export class PostService {
	constructor(private readonly repository: PostRepository) {}

	async createPost(input: PostCreateInput, actor: PostActor) {
		const post = await this.repository.createPost(input, actor.id);
		this.notifyModerators(post, actor);
		return this.toPostForActor(
			post,
			actor.role === "VISITOR"
				? new Map()
				: await this.repository.postVoteSummaries([input.id]),
			actor,
		);
	}

	async listPublishedPosts(filters: PostPageQuery, viewerId: string) {
		const result = await this.repository.listPublishedPosts(filters, viewerId);
		return {
			...result,
			posts: await this.toPosts(result.posts),
		};
	}

	async listMyPosts(actor: PostActor, filters: PostPageQuery) {
		const result = await this.repository.listMyPosts(
			actor.id,
			filters,
			actor.id,
		);
		return {
			...result,
			posts: await this.toPosts(result.posts, actor),
		};
	}

	async getPost(postId: string, actor: PostActor) {
		const post = await this.requireVisiblePost(postId, actor);
		return this.toPostForActor(
			post,
			actor.role === "VISITOR"
				? new Map()
				: await this.repository.postVoteSummaries([post.id]),
			actor,
		);
	}

	async updatePost(
		postId: string,
		data: PostUpdateFields & { imageKeys?: string[] },
		actor: PostActor,
	) {
		const post = await this.repository.findPostById(postId, actor.id);
		if (!post) throw new PostNotFoundError();
		if (post.status === "REMOVED") throw new PostStateConflictError();
		if (post.authorId !== actor.id) throw new PostForbiddenError();
		const updated = await this.repository.updatePost(
			postId,
			{
				...data,
				status: actor.role === "ADMIN" ? "PUBLISHED" : "PENDING",
				reviewerId: actor.role === "ADMIN" ? actor.id : null,
				moderationNote: null,
				rejectionReason: null,
			},
			actor.id,
		);
		this.notifyModerators(updated, actor);
		return this.toPostForActor(
			updated,
			actor.role === "VISITOR"
				? new Map()
				: await this.repository.postVoteSummaries([updated.id]),
			actor,
		);
	}

	async listPostsForModeration(
		filters: ModerationPostsQuery,
		actor: PostActor,
	) {
		this.assertAdmin(actor);
		const result = await this.repository.listPostsForModeration(
			filters,
			actor.id,
		);
		return {
			...result,
			posts: await this.toPosts(result.posts),
		};
	}

	async approvePost(postId: string, actor: PostActor, note?: string) {
		this.assertAdmin(actor);
		const result = await this.repository.moderatePost(
			postId,
			actor.id,
			"PUBLISHED",
			note ?? null,
		);
		if (result.count !== 1) throw new PostStateConflictError();
		return { postId, status: "PUBLISHED" as const };
	}

	async rejectPost(postId: string, actor: PostActor, reason: string) {
		this.assertAdmin(actor);
		const result = await this.repository.moderatePost(
			postId,
			actor.id,
			"REJECTED",
			reason,
		);
		if (result.count !== 1) throw new PostStateConflictError();
		return { postId, status: "REJECTED" as const };
	}

	async listComments(postId: string, filters: PostPageQuery, actor: PostActor) {
		await this.requireVisiblePost(postId, actor);
		const result = await this.repository.listComments(
			postId,
			filters,
			actor.id,
		);
		const comments = result.comments as CommentThreadView[];
		const ids = comments.flatMap((comment) => [
			comment.id,
			...comment.replies.map((reply) => reply.id),
		]);
		const summaries = await this.repository.commentVoteSummaries(ids);
		return {
			...result,
			comments: comments.map((comment) => this.toComment(comment, summaries)),
		};
	}

	async createComment(postId: string, input: CommentInput, actor: PostActor) {
		const post = await this.repository.findPostById(postId, actor.id);
		if (post?.status !== "PUBLISHED") throw new PostNotFoundError();
		if (input.parentId) {
			const parent = await this.repository.findCommentById(
				input.parentId,
				actor.id,
			);
			if (!parent || parent.postId !== postId) throw new CommentNotFoundError();
			if (parent.parentId) throw new PostReplyDepthError();
			if (parent.removedAt) {
				throw new PostStateConflictError(
					"You cannot reply to a removed comment",
				);
			}
		}
		const comment = await this.repository.createComment(
			{ postId, authorId: actor.id, ...input },
			actor.id,
		);
		return this.toComment(
			comment,
			await this.repository.commentVoteSummaries([comment.id]),
		);
	}

	async updateComment(
		commentId: string,
		input: CommentUpdate,
		actor: PostActor,
	) {
		const comment = await this.repository.findCommentById(commentId, actor.id);
		if (!comment) throw new CommentNotFoundError();
		if (comment.removedAt) throw new PostStateConflictError();
		if (comment.authorId !== actor.id) throw new PostForbiddenError();
		const post = await this.repository.findPostById(comment.postId, actor.id);
		if (post?.status !== "PUBLISHED") throw new PostNotFoundError();
		const updated = await this.repository.updateComment(
			commentId,
			input.body,
			actor.id,
		);
		return this.toComment(
			updated,
			await this.repository.commentVoteSummaries([updated.id]),
		);
	}

	async setPostVote(
		postId: string,
		direction: VoteDirection,
		actor: PostActor,
	) {
		const post = await this.repository.findPostById(postId, actor.id);
		if (post?.status !== "PUBLISHED") throw new PostNotFoundError();
		await this.repository.setPostVote(postId, actor.id, direction);
		return { postId, direction };
	}

	async removePostVote(postId: string, actor: PostActor) {
		const post = await this.repository.findPostById(postId, actor.id);
		if (post?.status !== "PUBLISHED") throw new PostNotFoundError();
		await this.repository.removePostVote(postId, actor.id);
		return { postId, direction: null };
	}

	async setCommentVote(
		commentId: string,
		direction: VoteDirection,
		actor: PostActor,
	) {
		const comment = await this.repository.findCommentById(commentId, actor.id);
		if (!comment || comment.removedAt) throw new CommentNotFoundError();
		const post = await this.repository.findPostById(comment.postId, actor.id);
		if (post?.status !== "PUBLISHED") throw new CommentNotFoundError();
		await this.repository.setCommentVote(commentId, actor.id, direction);
		return { commentId, direction };
	}

	async removeCommentVote(commentId: string, actor: PostActor) {
		const comment = await this.repository.findCommentById(commentId, actor.id);
		if (!comment || comment.removedAt) throw new CommentNotFoundError();
		await this.repository.removeCommentVote(commentId, actor.id);
		return { commentId, direction: null };
	}

	async reportPost(postId: string, reason: string, actor: PostActor) {
		const post = await this.repository.findPostById(postId, actor.id);
		if (post?.status !== "PUBLISHED") throw new PostNotFoundError();
		if (await this.repository.findOpenPostReport(postId, actor.id)) {
			throw new ContentReportConflictError();
		}
		const report = await this.repository.createPostReport(
			postId,
			actor.id,
			reason,
		);
		return { reportId: report.id, status: report.status };
	}

	async reportComment(commentId: string, reason: string, actor: PostActor) {
		const comment = await this.repository.findCommentById(commentId, actor.id);
		if (!comment || comment.removedAt) throw new CommentNotFoundError();
		const post = await this.repository.findPostById(comment.postId, actor.id);
		if (post?.status !== "PUBLISHED") throw new CommentNotFoundError();
		if (await this.repository.findOpenCommentReport(commentId, actor.id)) {
			throw new ContentReportConflictError();
		}
		const report = await this.repository.createCommentReport(
			commentId,
			actor.id,
			reason,
		);
		return { reportId: report.id, status: report.status };
	}

	async listReports(filters: ContentReportsQuery, actor: PostActor) {
		this.assertAdmin(actor);
		return this.repository.listReports(filters);
	}

	async dismissReport(reportId: string, actor: PostActor) {
		this.assertAdmin(actor);
		const result = await this.repository.dismissReport(reportId, actor.id);
		if (result.count !== 1) throw new PostStateConflictError();
		return { reportId, status: "DISMISSED" as const };
	}

	async removeReportedContent(reportId: string, actor: PostActor) {
		this.assertAdmin(actor);
		const result = await this.repository.removeReportedContent(
			reportId,
			actor.id,
		);
		if (result.outcome === "INVALID") throw new PostStateConflictError();
		return result;
	}

	private async requireVisiblePost(postId: string, actor: PostActor) {
		const post = await this.repository.findPostById(postId, actor.id);
		if (!post) throw new PostNotFoundError();
		if (actor.role === "VISITOR") {
			if (post.authorId === actor.id && post.status !== "REMOVED") return post;
			throw new PostNotFoundError();
		}
		if (
			post.status === "PUBLISHED" ||
			actor.role === "ADMIN" ||
			(post.status !== "REMOVED" && post.authorId === actor.id)
		) {
			return post;
		}
		throw new PostNotFoundError();
	}

	private assertAdmin(actor: PostActor) {
		if (actor.role !== "ADMIN") throw new PostForbiddenError();
	}

	private async toPosts(posts: PostView[], actor?: PostActor) {
		if (actor?.role === "VISITOR") {
			return posts.map((post) => this.toVisitorPost(post));
		}
		const summaries = await this.repository.postVoteSummaries(
			posts.map((post) => post.id),
		);
		return posts.map((post) => this.toPost(post, summaries));
	}

	private toPostForActor(
		post: PostView,
		summaries: Map<string, PostVoteSummary>,
		actor: PostActor,
	) {
		return actor.role === "VISITOR"
			? this.toVisitorPost(post)
			: this.toPost(post, summaries);
	}

	private toPost(post: PostView, summaries: Map<string, PostVoteSummary>) {
		const { imageKeys, votes, _count, ...data } = post;
		const summary = summaries.get(post.id) ?? { upvotes: 0, downvotes: 0 };
		return {
			...data,
			images: imageKeys.map(toStorageObjectUrl),
			commentCount: _count.comments,
			upvotes: summary.upvotes,
			downvotes: summary.downvotes,
			score: summary.upvotes - summary.downvotes,
			myVote: votes[0]?.direction ?? null,
		};
	}

	private toVisitorPost(post: PostView) {
		const {
			authorId: _authorId,
			reviewerId: _reviewerId,
			author: _author,
			reviewer: _reviewer,
			votes: _votes,
			_count,
			imageKeys,
			...data
		} = post;
		return { ...data, images: imageKeys.map(toStorageObjectUrl) };
	}

	private notifyModerators(
		post: Pick<PostView, "id" | "title" | "status">,
		actor: PostActor,
	) {
		if (!env.EVENTS_NOTIFICATION_EMAIL || !actor.email) return;
		void enqueueEmail(
			"content-notification",
			{
				to: env.EVENTS_NOTIFICATION_EMAIL,
				contentType: "Post",
				title: post.title,
				authorName:
					`${actor.firstName ?? "Publisher"} ${actor.lastName ?? ""}`.trim(),
				authorEmail: actor.email,
				status: post.status === "PUBLISHED" ? "PUBLISHED" : "PENDING",
			},
			`post-submitted-${post.id}-${Date.now()}`,
		).catch(() => undefined);
	}

	private toComment(
		comment: CommentThreadView,
		summaries: Map<string, PostVoteSummary>,
	): CommentOutput {
		return {
			...this.toCommentValue(comment, summaries),
			replies: comment.replies.map((reply) => this.toReply(reply, summaries)),
		};
	}

	private toReply(
		comment: CommentView,
		summaries: Map<string, PostVoteSummary>,
	): CommentOutput {
		return { ...this.toCommentValue(comment, summaries), replies: [] };
	}

	private toCommentValue(
		comment: CommentView,
		summaries: Map<string, PostVoteSummary>,
	): Omit<CommentOutput, "replies"> {
		const { votes, removedAt, body, ...data } = comment;
		const summary = summaries.get(comment.id) ?? { upvotes: 0, downvotes: 0 };
		return {
			...data,
			body: removedAt ? null : body,
			isRemoved: Boolean(removedAt),
			upvotes: summary.upvotes,
			downvotes: summary.downvotes,
			score: summary.upvotes - summary.downvotes,
			myVote: votes[0]?.direction ?? null,
		};
	}
}
