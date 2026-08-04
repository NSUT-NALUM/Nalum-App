import type {
	PostStatus,
	UserRole,
	VoteDirection,
} from "../../database/prisma/generated/client";
import type { PostFields, PostUpdateFields } from "./post.schema";

export type PostActor = {
	id: string;
	role: UserRole;
	firstName?: string;
	lastName?: string;
	email?: string;
};

export type PostCreateInput = PostFields & {
	id: string;
	authorId: string;
	imageKeys: string[];
	status: PostStatus;
};

export type PostUpdateInput = PostUpdateFields & {
	imageKeys?: string[];
	status: PostStatus;
	reviewerId: string | null;
	moderationNote: string | null;
	rejectionReason: string | null;
};

export type PostVoteSummary = {
	upvotes: number;
	downvotes: number;
};

export type VoteDirectionValue = VoteDirection | null;
