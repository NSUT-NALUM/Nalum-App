import { z } from "zod/v4";

const numberQuery = (schema: z.ZodNumber) =>
	z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() !== "" ? Number(value) : value,
		schema,
	);

const pagination = {
	limit: numberQuery(z.number().int().min(1).max(100)).default(20),
	offset: numberQuery(z.number().int().min(0)).default(0),
};

export const postFieldsSchema = z.object({
	title: z.string().trim().min(1).max(200),
	body: z.string().trim().min(1).max(10000),
});

export const postUpdateFieldsSchema = postFieldsSchema.partial();

export const postMultipartSchema = z.object({
	title: z.string().optional(),
	body: z.string().optional(),
	images: z.any().optional().meta({ type: "string", format: "binary" }),
});

export const postIdParamsSchema = z.object({ postId: z.uuid() });
export const commentIdParamsSchema = z.object({ commentId: z.uuid() });
export const reportIdParamsSchema = z.object({ reportId: z.uuid() });

export const pageQuerySchema = z.object(pagination);

export const moderationPostsQuerySchema = z.object({
	status: z
		.enum(["PENDING", "PUBLISHED", "REJECTED", "REMOVED"])
		.default("PENDING"),
	q: z.string().trim().min(1).optional(),
	...pagination,
});

export const commentSchema = z.object({
	body: z.string().trim().min(1).max(5000),
	parentId: z.uuid().optional(),
});

export const commentUpdateSchema = commentSchema.pick({
	body: true,
});

export const voteSchema = z.object({
	direction: z.enum(["UP", "DOWN"]),
});

export const reportSchema = z.object({
	reason: z.string().trim().min(1).max(1000),
});

export const moderationNoteSchema = z.object({
	note: z.string().trim().min(1).max(1000).optional(),
});

export const rejectionSchema = z.object({
	reason: z.string().trim().min(1).max(1000),
});

export const reportsQuerySchema = z.object({
	status: z.enum(["PENDING", "DISMISSED", "RESOLVED"]).default("PENDING"),
	target: z.enum(["post", "comment"]).optional(),
	...pagination,
});

export const postResponseSchema = z.object({
	success: z.literal(true),
	message: z.string(),
	data: z.unknown().nullable(),
});

export type PostFields = z.infer<typeof postFieldsSchema>;
export type PostUpdateFields = z.infer<typeof postUpdateFieldsSchema>;
export type PostIdParams = z.infer<typeof postIdParamsSchema>;
export type CommentIdParams = z.infer<typeof commentIdParamsSchema>;
export type ContentReportIdParams = z.infer<typeof reportIdParamsSchema>;
export type PostPageQuery = z.infer<typeof pageQuerySchema>;
export type ModerationPostsQuery = z.infer<typeof moderationPostsQuerySchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type CommentUpdate = z.infer<typeof commentUpdateSchema>;
export type PostVoteInput = z.infer<typeof voteSchema>;
export type ContentReportInput = z.infer<typeof reportSchema>;
export type PostModerationNote = z.infer<typeof moderationNoteSchema>;
export type PostRejectionInput = z.infer<typeof rejectionSchema>;
export type ContentReportsQuery = z.infer<typeof reportsQuerySchema>;
