import type {
	AlumniVerificationStatus,
	Branch,
	Campus,
	Experience,
	Profile,
	SocialMedia,
	UserRole,
} from "../../database/prisma/generated/client";
import type { AccessRevocationPublisher } from "../access/access-revocation.service";
import {
	ProfileAlreadyExistsError,
	ProfileNotFoundError,
	ProfileRollNumberRequiredError,
} from "./profile.errors";
import type { ProfileRepository } from "./profile.repository";

type ProfileUpdateData = Partial<
	Omit<Profile, "userId" | "createdAt" | "updatedAt">
>;
type SocialMediaUpdateData = Partial<Omit<SocialMedia, "userId">>;
type ExperienceUpdateData = Omit<Experience, "id" | "userId" | "createdAt">;

export class ProfileService {
	constructor(
		private readonly profileRepository: ProfileRepository,
		private readonly revocations?: AccessRevocationPublisher,
	) {}

	async getProfile(userId: string): Promise<Profile> {
		const profile = await this.profileRepository.findProfileByUserId(userId);
		if (!profile) {
			throw new ProfileNotFoundError();
		}
		return profile;
	}

	async createProfile(
		userId: string,
		data: {
			batch: number;
			branch: Branch;
			campus: Campus;
			rollNumber?: string;
		},
		role: UserRole = "STUDENT",
	): Promise<Profile> {
		const existingProfile =
			await this.profileRepository.findProfileByUserId(userId);
		if (existingProfile) {
			throw new ProfileAlreadyExistsError();
		}

		const rollNumber = data.rollNumber
			? this.normalizeRollNumber(data.rollNumber)
			: null;
		if (role === "ALUMNI" && !rollNumber) {
			throw new ProfileRollNumberRequiredError();
		}

		return this.profileRepository.createProfile(
			userId,
			{ ...data, rollNumber },
			role,
		);
	}

	async editProfile(
		userId: string,
		data: ProfileUpdateData,
		nested?: {
			socialMedia?: SocialMediaUpdateData;
			experiences?: ExperienceUpdateData[];
		},
		user?: {
			role: UserRole;
			verificationStatus: AlumniVerificationStatus | null;
		},
	): Promise<Profile> {
		const existingProfile =
			await this.profileRepository.findProfileByUserId(userId);
		if (!existingProfile) {
			throw new ProfileNotFoundError();
		}

		if (data.rollNumber !== undefined && data.rollNumber !== null) {
			data.rollNumber = this.normalizeRollNumber(data.rollNumber);
		}

		const hasSensitiveChange =
			user?.role === "ALUMNI" &&
			user.verificationStatus !== null &&
			(["rollNumber", "batch", "branch", "campus"] as const).some(
				(field) =>
					data[field] !== undefined && data[field] !== existingProfile[field],
			);

		const profile = await this.profileRepository.updateProfile(
			userId,
			data,
			nested,
			hasSensitiveChange,
		);
		if (hasSensitiveChange) {
			try {
				await this.revocations?.publish(userId);
			} catch {
				// The database-backed access check remains authoritative.
			}
		}
		return profile;
	}

	private normalizeRollNumber(rollNumber: string) {
		return rollNumber.trim().toUpperCase().replace(/\s+/g, "");
	}
}
