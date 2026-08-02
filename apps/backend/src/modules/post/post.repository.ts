import type {
	ContentReportStatus,
	PostStatus,
	Prisma,
	PrismaClient,
	VoteDirection,
} from "../../database/prisma/generated/client";
import type {
	ContentReportsQuery,
	ModerationPostsQuery,
	PostPageQuery,
} from "./post.schema";
import type { PostCreateInput, PostUpdateInput } from "./post.types";

const personSelect = {
	id: true,
	firstName: true,
	lastName: true,
} satisfies Prisma.UserSelect;

const postInclude = (viewerId: string) =>
	({
		author: { select: personSelect },
		reviewer: { select: personSelect },
		votes: { where: { userId: viewerId }, select: { direction: true } },
		_count: { select: { comments: { where: { removedAt: null } } } },
	}) satisfies Prisma.PostInclude;

const commentInclude = (viewerId: string) =>
	({
		author: { select: personSelect },
		votes: { where: { userId: viewerId }, select: { direction: true } },
		replies: {
			include: {
				author: { select: personSelect },
				votes: { where: { userId: viewerId }, select: { direction: true } },
			},
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		},
	}) satisfies Prisma.CommentInclude;

export class PostRepository {
	constructor(private readonly prisma: PrismaClient) {}

	createPost(input: PostCreateInput, viewerId: string) {
		return this.prisma.post.create({
			data: input,
			include: postInclude(viewerId),
		});
	}

	findPostById(postId: string, viewerId: string) {
		return this.prisma.post.findUnique({
			where: { id: postId },
			include: postInclude(viewerId),
		});
	}

	async listPublishedPosts(filters: PostPageQuery, viewerId: string) {
		const where = { status: "PUBLISHED" as const };
		const [posts, total] = await this.prisma.$transaction([
			this.prisma.post.findMany({
				where,
				include: postInclude(viewerId),
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.post.count({ where }),
		]);
		return { posts, total, limit: filters.limit, offset: filters.offset };
	}

	async listMyPosts(
		authorId: string,
		filters: PostPageQuery,
		viewerId: string,
	) {
		const where = { authorId };
		const [posts, total] = await this.prisma.$transaction([
			this.prisma.post.findMany({
				where,
				include: postInclude(viewerId),
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.post.count({ where }),
		]);
		return { posts, total, limit: filters.limit, offset: filters.offset };
	}

	async listPostsForModeration(
		filters: ModerationPostsQuery,
		viewerId: string,
	) {
		const where: Prisma.PostWhereInput = {
			status: filters.status as PostStatus,
			...(filters.q
				? {
						OR: [
							{ title: { contains: filters.q, mode: "insensitive" } },
							{ body: { contains: filters.q, mode: "insensitive" } },
						],
					}
				: {}),
		};
		const [posts, total] = await this.prisma.$transaction([
			this.prisma.post.findMany({
				where,
				include: postInclude(viewerId),
				orderBy: [{ createdAt: "asc" }, { id: "asc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.post.count({ where }),
		]);
		return { posts, total, limit: filters.limit, offset: filters.offset };
	}

	updatePost(postId: string, data: PostUpdateInput, viewerId: string) {
		return this.prisma.post.update({
			where: { id: postId },
			data,
			include: postInclude(viewerId),
		});
	}

	moderatePost(
		postId: string,
		reviewerId: string,
		status: "PUBLISHED" | "REJECTED",
		note: string | null,
	) {
		return this.prisma.post.updateMany({
			where: { id: postId, status: "PENDING" },
			data:
				status === "PUBLISHED"
					? {
							status,
							reviewerId,
							moderationNote: note,
							rejectionReason: null,
						}
					: {
							status,
							reviewerId,
							rejectionReason: note,
							moderationNote: null,
						},
		});
	}

	async listComments(postId: string, filters: PostPageQuery, viewerId: string) {
		const where = { postId, parentId: null };
		const [comments, total] = await this.prisma.$transaction([
			this.prisma.comment.findMany({
				where,
				include: commentInclude(viewerId),
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.comment.count({ where: { ...where, removedAt: null } }),
		]);
		return { comments, total, limit: filters.limit, offset: filters.offset };
	}

	findCommentById(commentId: string, viewerId: string) {
		return this.prisma.comment.findUnique({
			where: { id: commentId },
			include: commentInclude(viewerId),
		});
	}

	createComment(
		input: {
			postId: string;
			parentId?: string;
			authorId: string;
			body: string;
		},
		viewerId: string,
	) {
		return this.prisma.comment.create({
			data: input,
			include: commentInclude(viewerId),
		});
	}

	updateComment(commentId: string, body: string, viewerId: string) {
		return this.prisma.comment.update({
			where: { id: commentId },
			data: { body, editedAt: new Date() },
			include: commentInclude(viewerId),
		});
	}

	setPostVote(postId: string, userId: string, direction: VoteDirection) {
		return this.prisma.postVote.upsert({
			where: { postId_userId: { postId, userId } },
			create: { postId, userId, direction },
			update: { direction },
		});
	}

	removePostVote(postId: string, userId: string) {
		return this.prisma.postVote.deleteMany({ where: { postId, userId } });
	}

	setCommentVote(commentId: string, userId: string, direction: VoteDirection) {
		return this.prisma.commentVote.upsert({
			where: { commentId_userId: { commentId, userId } },
			create: { commentId, userId, direction },
			update: { direction },
		});
	}

	removeCommentVote(commentId: string, userId: string) {
		return this.prisma.commentVote.deleteMany({
			where: { commentId, userId },
		});
	}

	async postVoteSummaries(postIds: string[]) {
		if (!postIds.length)
			return new Map<string, { upvotes: number; downvotes: number }>();
		const rows = await this.prisma.postVote.groupBy({
			by: ["postId", "direction"],
			where: { postId: { in: postIds } },
			_count: { _all: true },
		});
		return this.toVoteSummary(rows, "postId");
	}

	async commentVoteSummaries(commentIds: string[]) {
		if (!commentIds.length)
			return new Map<string, { upvotes: number; downvotes: number }>();
		const rows = await this.prisma.commentVote.groupBy({
			by: ["commentId", "direction"],
			where: { commentId: { in: commentIds } },
			_count: { _all: true },
		});
		return this.toVoteSummary(rows, "commentId");
	}

	findOpenPostReport(postId: string, reporterId: string) {
		return this.prisma.contentReport.findFirst({
			where: { postId, reporterId, status: "PENDING" },
			select: { id: true },
		});
	}

	findOpenCommentReport(commentId: string, reporterId: string) {
		return this.prisma.contentReport.findFirst({
			where: { commentId, reporterId, status: "PENDING" },
			select: { id: true },
		});
	}

	createPostReport(postId: string, reporterId: string, reason: string) {
		return this.prisma.contentReport.create({
			data: { postId, reporterId, reason },
		});
	}

	createCommentReport(commentId: string, reporterId: string, reason: string) {
		return this.prisma.contentReport.create({
			data: { commentId, reporterId, reason },
		});
	}

	async listReports(filters: ContentReportsQuery) {
		const where: Prisma.ContentReportWhereInput = {
			status: filters.status as ContentReportStatus,
			...(filters.target === "post" ? { postId: { not: null } } : {}),
			...(filters.target === "comment" ? { commentId: { not: null } } : {}),
		};
		const include = {
			reporter: { select: personSelect },
			reviewer: { select: personSelect },
			post: {
				select: {
					id: true,
					title: true,
					status: true,
					author: { select: personSelect },
				},
			},
			comment: {
				select: {
					id: true,
					body: true,
					removedAt: true,
					author: { select: personSelect },
					post: { select: { id: true, title: true, status: true } },
				},
			},
		} satisfies Prisma.ContentReportInclude;
		const [reports, total] = await this.prisma.$transaction([
			this.prisma.contentReport.findMany({
				where,
				include,
				orderBy: [{ createdAt: "asc" }, { id: "asc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.contentReport.count({ where }),
		]);
		return { reports, total, limit: filters.limit, offset: filters.offset };
	}

	dismissReport(reportId: string, reviewerId: string) {
		return this.prisma.contentReport.updateMany({
			where: { id: reportId, status: "PENDING" },
			data: { status: "DISMISSED", reviewerId, reviewedAt: new Date() },
		});
	}

	async removeReportedContent(reportId: string, reviewerId: string) {
		return this.prisma.$transaction(async (tx) => {
			const report = await tx.contentReport.findUnique({
				where: { id: reportId },
				select: { id: true, status: true, postId: true, commentId: true },
			});
			if (report?.status !== "PENDING") return { outcome: "INVALID" as const };
			const now = new Date();
			if (report.postId) {
				const removed = await tx.post.updateMany({
					where: { id: report.postId, status: { not: "REMOVED" } },
					data: { status: "REMOVED", removedAt: now, reviewerId },
				});
				if (removed.count !== 1) return { outcome: "INVALID" as const };
				await tx.contentReport.updateMany({
					where: { postId: report.postId, status: "PENDING" },
					data: { status: "RESOLVED", reviewerId, reviewedAt: now },
				});
				return { outcome: "POST_REMOVED" as const, postId: report.postId };
			}
			if (report.commentId) {
				const removed = await tx.comment.updateMany({
					where: { id: report.commentId, removedAt: null },
					data: { removedAt: now, removedById: reviewerId },
				});
				if (removed.count !== 1) return { outcome: "INVALID" as const };
				await tx.contentReport.updateMany({
					where: { commentId: report.commentId, status: "PENDING" },
					data: { status: "RESOLVED", reviewerId, reviewedAt: now },
				});
				return {
					outcome: "COMMENT_REMOVED" as const,
					commentId: report.commentId,
				};
			}
			return { outcome: "INVALID" as const };
		});
	}

	private toVoteSummary(
		rows: Array<{
			direction: VoteDirection;
			_count: { _all: number };
			postId?: string;
			commentId?: string;
		}>,
		idKey: "postId" | "commentId",
	) {
		const summary = new Map<string, { upvotes: number; downvotes: number }>();
		for (const row of rows) {
			const id = row[idKey];
			if (!id) continue;
			const current = summary.get(id) ?? { upvotes: 0, downvotes: 0 };
			if (row.direction === "UP") current.upvotes = row._count._all;
			else current.downvotes = row._count._all;
			summary.set(id, current);
		}
		return summary;
	}
}
