import type {
	Branch,
	Campus,
	Experience,
	PrismaClient,
	Profile,
	SocialMedia,
	UserRole,
} from "../../database/prisma/generated/client";

type ProfileUpdateData = Partial<
	Omit<Profile, "userId" | "createdAt" | "updatedAt">
>;
type SocialMediaUpdateData = Partial<Omit<SocialMedia, "userId">>;
type ExperienceUpdateData = Omit<Experience, "id" | "userId" | "createdAt">;

export class ProfileRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async findProfileByUserId(userId: string): Promise<Profile | null> {
		return this.prisma.profile.findUnique({
			where: { userId },
		});
	}

	async createProfile(
		userId: string,
		data: {
			batch: number;
			branch: Branch;
			campus: Campus;
			rollNumber: string | null;
		},
		role: UserRole,
	): Promise<Profile> {
		return this.prisma.$transaction(async (tx) => {
			const submittedAt = new Date();
			const profile = await tx.profile.create({
				data: {
					userId,
					batch: data.batch,
					branch: data.branch,
					campus: data.campus,
					rollNumber: data.rollNumber,
				},
			});

			await tx.user.update({
				where: { id: userId },
				data: {
					profileCompleted: true,
					verificationStatus: role === "ALUMNI" ? "PENDING" : null,
					verificationSubmittedAt: role === "ALUMNI" ? submittedAt : null,
				},
			});
			if (role === "ALUMNI") {
				await tx.alumniVerificationEvent.create({
					data: {
						userId,
						type: "SUBMITTED",
						newStatus: "PENDING",
						notificationState: "NOT_REQUIRED",
						createdAt: submittedAt,
					},
				});
			}

			return profile;
		});
	}

	async updateProfile(
		userId: string,
		data: ProfileUpdateData,
		nested?: {
			socialMedia?: SocialMediaUpdateData;
			experiences?: ExperienceUpdateData[];
		},
		hasSensitiveChange = false,
	): Promise<Profile> {
		return this.prisma.$transaction(async (tx) => {
			const profile = await tx.profile.update({
				where: { userId },
				data,
			});

			if (nested?.socialMedia) {
				await tx.socialMedia.upsert({
					where: { userId },
					create: {
						userId,
						...nested.socialMedia,
					},
					update: nested.socialMedia,
				});
			}

			if (nested?.experiences) {
				await tx.experience.deleteMany({
					where: { userId },
				});

				if (nested.experiences.length > 0) {
					await tx.experience.createMany({
						data: nested.experiences.map((experience) => ({
							userId,
							...experience,
						})),
					});
				}
			}

			if (hasSensitiveChange) {
				const changedAt = new Date();
				const user = await tx.user.findUniqueOrThrow({
					where: { id: userId },
					select: { verificationStatus: true },
				});
				await tx.user.update({
					where: { id: userId },
					data: {
						verificationStatus: "PENDING",
						verificationSubmittedAt: changedAt,
					},
				});
				await tx.alumniVerificationEvent.create({
					data: {
						userId,
						type: "AUTO_RESUBMITTED",
						previousStatus: user.verificationStatus,
						newStatus: "PENDING",
						reason: "Verification details were changed by the applicant",
						notificationState: "NOT_REQUIRED",
						createdAt: changedAt,
					},
				});
			}

			return profile;
		});
	}
}
