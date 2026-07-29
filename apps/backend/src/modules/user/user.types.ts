import type {
	AlumniVerificationEvent,
	Branch,
	Campus,
	Experience,
	Profile,
	SocialMedia,
	User,
	UserBan,
	UserRole,
} from "../../database/prisma/generated/client";

export type UserDetailsRecord = User & {
	profile: Profile | null;
	socialMedia: SocialMedia | null;
	experiences: Experience[];
	verificationEvents: AlumniVerificationEvent[];
	bans: UserBan[];
};

export type PublicUserDetails = Omit<User, "passwordHash" | "googleId"> & {
	profile: Profile | null;
	socialMedia: SocialMedia | null;
	experiences: Experience[];
	latestReviewReason: string | null;
	activeBan: Pick<UserBan, "reason" | "expiresAt" | "startsAt"> | null;
};

export type SearchUsersFilters = {
	q?: string;
	role?: UserRole;
	campus?: Campus;
	branch?: Branch;
	batch?: number;
	company?: string;
	city?: string;
	country?: string;
	emailVerified?: boolean;
	profileCompleted?: boolean;
	limit: number;
	offset: number;
};
