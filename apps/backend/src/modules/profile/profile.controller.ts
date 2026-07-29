import type { FastifyReply, FastifyRequest } from "fastify";
import type {
	Branch,
	Campus,
	Experience,
	Profile,
	SocialMedia,
} from "../../database/prisma/generated/client";
import BadRequestError from "../../errors/bad-request.error";
import { getCurrentUser } from "../../middlewares/auth.middleware";
import {
	PROFILE_PICTURE_UPLOAD_PREFIX,
	toStorageObjectUrl,
} from "../storage/storage.keys";
import {
	type CreateProfileBody,
	type ExperienceInput,
	editProfileSchemaRequest,
	experienceInputSchema,
	type SocialMediaInput,
	socialMediaInputSchema,
} from "./profile.schema";
import type { ProfileService } from "./profile.service";

export class ProfileController {
	constructor(private readonly profileService: ProfileService) {}

	createProfile = async (
		request: FastifyRequest,
		reply: FastifyReply,
	): Promise<void> => {
		const currentUser = getCurrentUser(request);
		const userId = currentUser.id;
		const { batch, branch, campus, rollNumber } =
			request.body as CreateProfileBody;

		const profile = await this.profileService.createProfile(
			userId,
			{
				batch,
				branch: branch as Branch,
				campus: campus as Campus,
				rollNumber,
			},
			currentUser.role,
		);

		await reply.success(
			this.toProfileResponse(profile),
			"Profile created successfully",
			201,
		);
	};

	getProfile = async (
		request: FastifyRequest,
		reply: FastifyReply,
	): Promise<void> => {
		const userId = getCurrentUser(request).id;
		const profile = await this.profileService.getProfile(userId);

		await reply.success(
			this.toProfileResponse(profile),
			"Profile retrieved successfully",
		);
	};

	editProfile = async (
		request: FastifyRequest,
		reply: FastifyReply,
	): Promise<void> => {
		const currentUser = getCurrentUser(request);
		const userId = currentUser.id;

		if (!request.isMultipart()) {
			throw new BadRequestError(
				"Multipart request expected",
				"MULTIPART_REQUIRED",
			);
		}

		const parts = request.parts();
		const fields: Record<string, string> = {};
		let profilePictureKey: string | undefined;

		for await (const part of parts) {
			if (part.type === "file") {
				if (part.fieldname === "profilePicture") {
					const partitionSegments = [PROFILE_PICTURE_UPLOAD_PREFIX, userId];

					const uploadResult = await request.server.storage.uploadImage(
						{
							filename: part.filename,
							mimetype: part.mimetype,
							toBuffer: async () => part.toBuffer(),
						},
						partitionSegments,
					);
					profilePictureKey = uploadResult.key;
				}
			} else {
				fields[part.fieldname] = part.value as string;
			}
		}

		const updateData: Partial<
			Omit<Profile, "userId" | "createdAt" | "updatedAt">
		> = {};
		const validatedFields = editProfileSchemaRequest.parse(fields);

		if (validatedFields.batch !== undefined)
			updateData.batch = validatedFields.batch;
		if (validatedFields.rollNumber !== undefined)
			updateData.rollNumber = validatedFields.rollNumber;
		if (validatedFields.branch !== undefined)
			updateData.branch = validatedFields.branch as Branch;
		if (validatedFields.campus !== undefined)
			updateData.campus = validatedFields.campus as Campus;
		if (validatedFields.phoneNumber !== undefined)
			updateData.phoneNumber = validatedFields.phoneNumber;
		if (validatedFields.alternateEmail !== undefined)
			updateData.alternateEmail = validatedFields.alternateEmail;
		if (validatedFields.city !== undefined)
			updateData.city = validatedFields.city;
		if (validatedFields.country !== undefined)
			updateData.country = validatedFields.country;
		if (validatedFields.currentCompany !== undefined)
			updateData.currentCompany = validatedFields.currentCompany;
		if (validatedFields.currentRole !== undefined)
			updateData.currentRole = validatedFields.currentRole;
		if (profilePictureKey !== undefined)
			updateData.profilePicture = profilePictureKey;

		const nestedData = this.parseNestedProfileFields(fields);

		const updatedProfile = await this.profileService.editProfile(
			userId,
			updateData,
			nestedData,
			{
				role: currentUser.role,
				verificationStatus: currentUser.verificationStatus,
			},
		);

		await reply.success(
			this.toProfileResponse(updatedProfile),
			"Profile updated successfully",
		);
	};

	private toProfileResponse(profile: Profile): Profile {
		return {
			...profile,
			profilePicture: toStorageObjectUrl(profile.profilePicture),
		};
	}

	private parseNestedProfileFields(fields: Record<string, string>): {
		socialMedia?: Partial<Omit<SocialMedia, "userId">>;
		experiences?: Omit<Experience, "id" | "userId" | "createdAt">[];
	} {
		const nestedData: {
			socialMedia?: Partial<Omit<SocialMedia, "userId">>;
			experiences?: Omit<Experience, "id" | "userId" | "createdAt">[];
		} = {};

		const socialMedia = this.parseSocialMedia(fields);
		if (socialMedia) {
			nestedData.socialMedia = socialMedia;
		}

		if (fields.experiences !== undefined) {
			nestedData.experiences = this.parseExperiences(fields.experiences);
		}

		return nestedData;
	}

	private parseSocialMedia(
		fields: Record<string, string>,
	): Partial<Omit<SocialMedia, "userId">> | undefined {
		if (fields.socialMedia !== undefined) {
			return socialMediaInputSchema.parse(
				this.parseJsonField<SocialMediaInput>(
					fields.socialMedia,
					"socialMedia",
				),
			);
		}

		const socialMediaFields: Partial<Omit<SocialMedia, "userId">> = {};
		for (const key of ["linkedin", "github", "twitter", "website"] as const) {
			if (fields[key] !== undefined) {
				socialMediaFields[key] = fields[key];
			}
		}

		return Object.keys(socialMediaFields).length
			? socialMediaFields
			: undefined;
	}

	private parseExperiences(
		value: string,
	): Omit<Experience, "id" | "userId" | "createdAt">[] {
		const parsed = this.parseJsonField<ExperienceInput[]>(value, "experiences");
		if (!Array.isArray(parsed)) {
			throw new BadRequestError(
				"Experiences must be a JSON array",
				"INVALID_EXPERIENCES",
			);
		}

		return parsed.map((experience) => {
			const validated = experienceInputSchema.parse(experience);
			return {
				company: validated.company,
				role: validated.role,
				startDate: validated.startDate ?? null,
				endDate: validated.endDate ?? null,
				isCurrent: validated.isCurrent ?? false,
			};
		});
	}

	private parseJsonField<T>(value: string, fieldName: string): T {
		try {
			return JSON.parse(value) as T;
		} catch {
			throw new BadRequestError(
				`${fieldName} must be valid JSON`,
				"INVALID_JSON_FIELD",
			);
		}
	}
}
