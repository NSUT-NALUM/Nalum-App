import type {
	AlumniVerificationEvent,
	Profile,
	User,
	UserBan,
} from "../../database/prisma/generated/client";

export type AdminUserRecord = User & {
	profile: Profile | null;
	bans: UserBan[];
	verificationEvents?: AlumniVerificationEvent[];
};

export type ReviewDecisionResult = {
	eventId: string;
	userId: string;
	email: string;
	firstName: string;
	status: "VERIFIED" | "REJECTED";
	reason: string | null;
};
