import { z } from "zod/v4";
import {
	BranchEnum,
	CampusEnum,
	profileDataSchema,
} from "../profile/profile.schema";

const UserRoleEnum = z.enum([
	"STUDENT",
	"ALUMNI",
	"ADMIN",
	"PROFESSOR",
	"VISITOR",
]);

const booleanQuerySchema = z.preprocess((value) => {
	if (value === "true") return true;
	if (value === "false") return false;
	return value;
}, z.boolean());

const numberQuerySchema = (schema: z.ZodNumber) =>
	z.preprocess((value) => {
		if (typeof value === "string" && value.trim() !== "") {
			return Number(value);
		}
		return value;
	}, schema);

export const searchUsersQuerySchema = z.object({
	q: z.string().min(1).optional(),
	role: UserRoleEnum.optional(),
	campus: CampusEnum.optional(),
	branch: BranchEnum.optional(),
	batch: numberQuerySchema(z.number().int().min(1900).max(2100)).optional(),
	company: z.string().min(1).optional(),
	city: z.string().min(1).optional(),
	country: z.string().min(1).optional(),
	emailVerified: booleanQuerySchema.optional(),
	profileCompleted: booleanQuerySchema.optional(),
	limit: numberQuerySchema(z.number().int().min(1).max(100)).default(20),
	offset: numberQuerySchema(z.number().int().min(0)).default(0),
});

export const socialMediaSchema = z.object({
	userId: z.uuid(),
	linkedin: z.string().nullable(),
	github: z.string().nullable(),
	twitter: z.string().nullable(),
	website: z.string().nullable(),
});

export const experienceSchema = z.object({
	id: z.uuid(),
	userId: z.uuid(),
	company: z.string(),
	role: z.string(),
	startDate: z.date().nullable(),
	endDate: z.date().nullable(),
	isCurrent: z.boolean(),
	createdAt: z.date(),
});

export const userDetailsSchema = z.object({
	id: z.uuid(),
	firstName: z.string(),
	lastName: z.string().nullable(),
	email: z.email(),
	role: UserRoleEnum,
	emailVerified: z.boolean(),
	emailVerifiedAt: z.date().nullable(),
	verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).nullable(),
	verificationSubmittedAt: z.date().nullable(),
	latestReviewReason: z.string().nullable(),
	activeBan: z
		.object({
			reason: z.string(),
			expiresAt: z.date().nullable(),
			startsAt: z.date(),
		})
		.nullable(),
	profileCompleted: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
	profile: profileDataSchema.nullable(),
	socialMedia: socialMediaSchema.nullable(),
	experiences: z.array(experienceSchema),
});

export const userDetailsResponseSchema = z.object({
	success: z.literal(true),
	message: z.string(),
	data: userDetailsSchema,
});

export const searchUsersResponseSchema = z.object({
	success: z.literal(true),
	message: z.string(),
	data: z.object({
		users: z.array(userDetailsSchema),
		total: z.number().int(),
		limit: z.number().int(),
		offset: z.number().int(),
	}),
});

export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;
