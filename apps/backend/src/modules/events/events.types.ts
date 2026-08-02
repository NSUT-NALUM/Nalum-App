import type { EventStatus, UserRole } from "../../database/prisma/generated/client";
import type { EventFields, EventUpdateFields } from "./events.schema";

export type EventCreateInput = EventFields & {
	id: string;
	authorId: string;
	imageKeys: string[];
	status: EventStatus;
};

export type EventPatchInput = EventUpdateFields & { imageKeys?: string[] };

export type EventActor = {
	id: string;
	role: UserRole;
	verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | null;
};
