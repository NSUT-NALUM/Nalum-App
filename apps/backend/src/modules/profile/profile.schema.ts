import { z } from "zod/v4";

// Enum definitions matching schema.prisma
export const CampusEnum = z.enum(["MAIN", "EAST", "WEST"]);
export const BranchEnum = z.enum([
	"CSE",
	"ECE",
	"MECH",
	"CIVIL",
	"CHEMICAL",
	"BIOTECH",
	"ELECTRICAL",
	"INSTRUMENTATION",
	"AEROSPACE",
	"MATERIALS",
	"INDUSTRIAL",
	"PRODUCTION",
]);

export const createProfileSchemaRequest = z.object({
	rollNumber: z.string().trim().min(1).max(50).optional(),
	batch: z
		.number()
		.int()
		.min(1900, "Invalid batch year")
		.max(2100, "Invalid batch year")
		.describe("Year of graduation/batch."),
	branch: BranchEnum.describe("Academic branch."),
	campus: CampusEnum.describe("Campus location."),
});

// Since PUT uses multipart form data, coerce batch to number
export const editProfileSchemaRequest = z.object({
	rollNumber: z.string().trim().min(1).max(50).optional(),
	batch: z
		.preprocess(
			(val) => (typeof val === "string" ? parseInt(val, 10) : val),
			z.number().int().min(1900).max(2100),
		)
		.optional()
		.describe("Updated batch year."),
	branch: BranchEnum.optional().describe("Updated academic branch."),
	campus: CampusEnum.optional().describe("Updated campus location."),
	phoneNumber: z
		.string()
		.trim()
		.regex(
			/^\+[1-9]\d{6,14}$/,
			"Use an international number such as +919876543210",
		)
		.optional(),
	alternateEmail: z.email().optional(),
	city: z.string().optional().describe("Current city."),
	country: z.string().optional().describe("Current country."),
	currentCompany: z.string().optional().describe("Current company name."),
	currentRole: z.string().optional().describe("Current job role."),
});

export const socialMediaInputSchema = z.object({
	linkedin: z.string().optional().nullable(),
	github: z.string().optional().nullable(),
	twitter: z.string().optional().nullable(),
	website: z.string().optional().nullable(),
});

export const experienceInputSchema = z.object({
	company: z.string().min(1),
	role: z.string().min(1),
	startDate: z.coerce.date().optional().nullable(),
	endDate: z.coerce.date().optional().nullable(),
	isCurrent: z.boolean().optional(),
});

export const profileDataSchema = z.object({
	userId: z.uuid().describe("Unique user ID."),
	rollNumber: z.string().nullable().describe("Normalized alumni roll number."),
	batch: z.number().int().describe("Batch year."),
	branch: BranchEnum.describe("Branch name."),
	campus: CampusEnum.describe("Campus location."),
	phoneNumber: z.string().nullable(),
	alternateEmail: z.email().nullable(),
	city: z.string().nullable().describe("Current city."),
	country: z.string().nullable().describe("Current country."),
	currentCompany: z.string().nullable().describe("Current company name."),
	currentRole: z.string().nullable().describe("Current job role."),
	profilePicture: z
		.string()
		.nullable()
		.describe("URL path to the profile picture."),
	createdAt: z.date().describe("Profile creation date."),
	updatedAt: z.date().describe("Profile last updated date."),
});

export const profileResponseSchema = z.object({
	success: z.literal(true).describe("Indicates successful execution."),
	message: z.string().describe("Human-readable response message."),
	data: profileDataSchema.nullable().describe("The user profile data."),
});

// Schema for multipart edit profile documentation in Swagger
export const editProfileMultipartSchemaRequest = z.object({
	profilePicture: z
		.any()
		.meta({ type: "string", format: "binary" })
		.optional()
		.describe("Profile picture file to upload (JPEG/PNG/WebP/GIF)."),
	batch: z.string().optional().describe("Batch year."),
	rollNumber: z.string().optional().describe("Alumni roll number."),
	branch: BranchEnum.optional().describe("Branch name."),
	campus: CampusEnum.optional().describe("Campus location."),
	phoneNumber: z
		.string()
		.optional()
		.describe("International phone or WhatsApp number."),
	alternateEmail: z.string().optional().describe("Alternate contact email."),
	city: z.string().optional().describe("Current city."),
	country: z.string().optional().describe("Current country."),
	currentCompany: z.string().optional().describe("Current company name."),
	currentRole: z.string().optional().describe("Current job role."),
	socialMedia: z
		.string()
		.optional()
		.describe("JSON object containing linkedin, github, twitter, website."),
	experiences: z
		.string()
		.optional()
		.describe("JSON array of experience objects."),
});

export type CreateProfileBody = z.infer<typeof createProfileSchemaRequest>;
export type EditProfileBody = z.infer<typeof editProfileSchemaRequest>;
export type EditProfileMultipartBody = z.infer<
	typeof editProfileMultipartSchemaRequest
>;
export type SocialMediaInput = z.infer<typeof socialMediaInputSchema>;
export type ExperienceInput = z.infer<typeof experienceInputSchema>;
export type ProfileData = z.infer<typeof profileDataSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
