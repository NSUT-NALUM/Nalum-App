import type {
	OpportunityStatus,
	OpportunityType,
	OpportunityWorkMode,
	UserRole,
} from "../../database/prisma/generated/client";

export type OpportunityActor = {
	id: string;
	role: UserRole;
	verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | null;
	firstName?: string;
	lastName?: string | null;
	email?: string;
};

export type OpportunityCreateInput = {
	id: string;
	authorId: string;
	roleTitle: string;
	organization: string;
	description: string;
	type: OpportunityType;
	workMode: OpportunityWorkMode;
	location: string;
	deadline: Date;
	applicationUrl: string;
	status: OpportunityStatus;
};
