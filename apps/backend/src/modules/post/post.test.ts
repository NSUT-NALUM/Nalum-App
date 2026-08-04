import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentReportConflictError, PostReplyDepthError } from "./post.errors";
import { PostService } from "./post.service";
import type { PostActor } from "./post.types";

const { enqueueEmail } = vi.hoisted(() => ({ enqueueEmail: vi.fn() }));

vi.mock("../../config/env.config", () => ({
	env: { EVENTS_NOTIFICATION_EMAIL: "events@example.test" },
}));
vi.mock("../../queues/email.queue", () => ({ enqueueEmail }));

const actor = (overrides: Partial<PostActor> = {}): PostActor => ({
	id: crypto.randomUUID(),
	role: "STUDENT",
	...overrides,
});

const post = (overrides = {}) => ({
	id: crypto.randomUUID(),
	title: "A post",
	body: "A body",
	imageKeys: [],
	status: "PUBLISHED" as const,
	authorId: crypto.randomUUID(),
	reviewerId: null,
	moderationNote: null,
	rejectionReason: null,
	removedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	author: { id: crypto.randomUUID(), firstName: "Ada", lastName: "Lovelace" },
	reviewer: null,
	votes: [],
	_count: { comments: 0 },
	...overrides,
});

const repository = () => ({
	createPost: vi.fn(),
	findPostById: vi.fn(),
	listPublishedPosts: vi.fn(),
	listMyPosts: vi.fn(),
	listPostsForModeration: vi.fn(),
	updatePost: vi.fn(),
	moderatePost: vi.fn(),
	listComments: vi.fn(),
	findCommentById: vi.fn(),
	createComment: vi.fn(),
	updateComment: vi.fn(),
	setPostVote: vi.fn(),
	removePostVote: vi.fn(),
	setCommentVote: vi.fn(),
	removeCommentVote: vi.fn(),
	postVoteSummaries: vi.fn().mockResolvedValue(new Map()),
	commentVoteSummaries: vi.fn().mockResolvedValue(new Map()),
	findOpenPostReport: vi.fn(),
	findOpenCommentReport: vi.fn(),
	createPostReport: vi.fn(),
	createCommentReport: vi.fn(),
	listReports: vi.fn(),
	dismissReport: vi.fn(),
	removeReportedContent: vi.fn(),
});

describe("PostService", () => {
	let repo: ReturnType<typeof repository>;
	let service: PostService;

	beforeEach(() => {
		repo = repository();
		service = new PostService(repo as never);
	});

	it("returns a non-admin edit to pending review", async () => {
		const user = actor();
		const current = post({ authorId: user.id });
		repo.findPostById.mockResolvedValue(current);
		repo.updatePost.mockResolvedValue({ ...current, status: "PENDING" });

		await service.updatePost(current.id, { title: "Revised" }, user);

		expect(repo.updatePost).toHaveBeenCalledWith(
			current.id,
			expect.objectContaining({
				title: "Revised",
				status: "PENDING",
				reviewerId: null,
				moderationNote: null,
				rejectionReason: null,
			}),
			user.id,
		);
	});

	it("does not expose member identity or engagement to a visitor", async () => {
		const visitor = actor({ role: "VISITOR" });
		const current = post({ authorId: visitor.id, status: "PENDING" });
		repo.findPostById.mockResolvedValue(current);

		const result = await service.getPost(current.id, visitor);

		expect(result).toMatchObject({ id: current.id, title: current.title });
		expect(result).not.toHaveProperty("author");
		expect(result).not.toHaveProperty("commentCount");
		expect(result).not.toHaveProperty("score");
	});

	it("does not allow replies to a reply", async () => {
		const user = actor();
		repo.findPostById.mockResolvedValue(post());
		repo.findCommentById.mockResolvedValue({
			id: crypto.randomUUID(),
			postId: "post-id",
			parentId: crypto.randomUUID(),
			removedAt: null,
		});

		await expect(
			service.createComment(
				"post-id",
				{ body: "Nested", parentId: crypto.randomUUID() },
				user,
			),
		).rejects.toBeInstanceOf(PostReplyDepthError);
	});

	it("prevents duplicate open reports from the same user", async () => {
		const user = actor();
		repo.findPostById.mockResolvedValue(post());
		repo.findOpenPostReport.mockResolvedValue({ id: crypto.randomUUID() });

		await expect(
			service.reportPost(crypto.randomUUID(), "Harassment", user),
		).rejects.toBeInstanceOf(ContentReportConflictError);
	});
});
