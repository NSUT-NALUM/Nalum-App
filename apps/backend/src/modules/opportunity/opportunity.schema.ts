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

const deadlineSchema = z.iso.date().transform((value) => {
	// Asia/Kolkata is UTC+05:30, so this is the inclusive end of the chosen day.
	return new Date(`${value}T18:29:59.999Z`);
});

const httpsUrlSchema = z
	.url()
	.refine((value) => new URL(value).protocol === "https:", {
		message: "Application URL must use HTTPS",
	});

export const opportunityFieldsSchema = z.object({
	roleTitle: z.string().trim().min(1).max(200),
	organization: z.string().trim().min(1).max(200),
	description: z.string().trim().min(1).max(10_000),
	type: z.enum(["INTERNSHIP", "JOB"]),
	workMode: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
	location: z.string().trim().min(1).max(300),
	deadline: deadlineSchema,
	applicationUrl: httpsUrlSchema,
});

export const opportunityUpdateSchema = opportunityFieldsSchema.partial();
export const opportunityIdParamsSchema = z.object({ opportunityId: z.uuid() });
export const opportunityPageQuerySchema = z.object(pagination);
export const moderationOpportunitiesQuerySchema = z.object({
	status: z
		.enum(["PENDING", "PUBLISHED", "REJECTED", "REMOVED"])
		.default("PENDING"),
	q: z.string().trim().min(1).optional(),
	...pagination,
});
export const moderationNoteSchema = z.object({
	note: z.string().trim().min(1).max(1000).optional(),
});
export const rejectionSchema = z.object({
	reason: z.string().trim().min(1).max(1000),
});
export const opportunityResponseSchema = z.object({
	success: z.literal(true),
	message: z.string(),
	data: z.unknown().nullable(),
});

export type OpportunityFields = z.infer<typeof opportunityFieldsSchema>;
export type OpportunityUpdate = z.infer<typeof opportunityUpdateSchema>;
export type OpportunityIdParams = z.infer<typeof opportunityIdParamsSchema>;
export type OpportunityPageQuery = z.infer<typeof opportunityPageQuerySchema>;
export type ModerationOpportunitiesQuery = z.infer<
	typeof moderationOpportunitiesQuerySchema
>;
export type OpportunityModerationNote = z.infer<typeof moderationNoteSchema>;
export type OpportunityRejection = z.infer<typeof rejectionSchema>;
