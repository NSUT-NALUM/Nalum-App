import { z } from "zod/v4";
import { BranchEnum, CampusEnum } from "../profile/profile.schema";

const numberQuery = (schema: z.ZodNumber) =>
	z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() !== "" ? Number(value) : value,
		schema,
	);

const pagination = {
	limit: numberQuery(z.number().int().min(1).max(100)).default(25),
	offset: numberQuery(z.number().int().min(0)).default(0),
};

export const alumniReviewQuerySchema = z.object({
	q: z.string().trim().min(1).optional(),
	status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
	branch: BranchEnum.optional(),
	campus: CampusEnum.optional(),
	batch: numberQuery(z.number().int().min(1900).max(2100)).optional(),
	...pagination,
});

export const adminUsersQuerySchema = z.object({
	q: z.string().trim().min(1).optional(),
	role: z
		.enum(["STUDENT", "ALUMNI", "ADMIN", "PROFESSOR", "VISITOR"])
		.optional(),
	verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
	banStatus: z.enum(["ACTIVE", "NONE"]).optional(),
	registeredFrom: z.coerce.date().optional(),
	registeredTo: z.coerce.date().optional(),
	...pagination,
});

export const userIdParamsSchema = z.object({ userId: z.uuid() });

export const approveSchema = z.object({
	note: z.string().trim().min(1).max(1000).optional(),
});

export const reasonSchema = z.object({
	reason: z.string().trim().min(1).max(1000),
});

export const banSchema = reasonSchema.extend({
	expiresAt: z.coerce.date().nullable().optional(),
});

export const adminResponseSchema = z.object({
	success: z.literal(true),
	message: z.string(),
	data: z.unknown().nullable(),
});

export type AlumniReviewQuery = z.infer<typeof alumniReviewQuerySchema>;
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type ApproveBody = z.infer<typeof approveSchema>;
export type ReasonBody = z.infer<typeof reasonSchema>;
export type BanBody = z.infer<typeof banSchema>;
