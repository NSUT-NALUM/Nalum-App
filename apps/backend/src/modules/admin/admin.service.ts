import type { AccessRevocationPublisher } from "../access/access-revocation.service";
import type { EmailService } from "../email/email.service";
import {
	ActiveBanConflictError,
	AdminUserNotFoundError,
	InvalidBanExpiryError,
	ProtectedAdminBanError,
	ReviewDecisionConflictError,
	ReviewReopenConflictError,
} from "./admin.errors";
import type { AdminRepository } from "./admin.repository";
import type {
	AdminUsersQuery,
	AlumniReviewQuery,
	BanBody,
} from "./admin.schema";
import type { ReviewDecisionResult } from "./admin.types";

export class AdminService {
	constructor(
		private readonly repository: AdminRepository,
		private readonly emailService: EmailService,
		private readonly revocations: AccessRevocationPublisher,
	) {}

	getOverview() {
		return this.repository.getOverview();
	}

	async listAlumni(filters: AlumniReviewQuery) {
		const result = await this.repository.listAlumni(filters);
		return {
			...result,
			users: result.users.map((user) => this.withoutCredentials(user)),
		};
	}

	async getApplication(userId: string) {
		const application = await this.repository.findApplication(userId);
		if (!application) throw new AdminUserNotFoundError();
		return this.withoutCredentials(application);
	}

	async approve(userId: string, actorId: string, note?: string) {
		const decision = await this.repository.decideApplication(
			userId,
			actorId,
			"VERIFIED",
			note ?? null,
		);
		if (!decision) throw new ReviewDecisionConflictError();
		await this.queueDecisionNotification(decision);
		return { status: "VERIFIED" as const, eventId: decision.eventId };
	}

	async reject(userId: string, actorId: string, reason: string) {
		const decision = await this.repository.decideApplication(
			userId,
			actorId,
			"REJECTED",
			reason,
		);
		if (!decision) throw new ReviewDecisionConflictError();
		await this.queueDecisionNotification(decision);
		await this.publishRevocation(userId);
		return { status: "REJECTED" as const, eventId: decision.eventId };
	}

	async reopen(userId: string, actorId: string, reason: string) {
		const event = await this.repository.reopenApplication(
			userId,
			actorId,
			reason,
		);
		if (!event) throw new ReviewReopenConflictError();
		await this.publishRevocation(userId);
		return { status: "PENDING" as const, eventId: event.id };
	}

	async listUsers(filters: AdminUsersQuery) {
		const result = await this.repository.listUsers(filters);
		return {
			...result,
			users: result.users.map((user) => this.withoutCredentials(user)),
		};
	}

	async getUser(userId: string) {
		const user = await this.repository.findUser(userId);
		if (!user) throw new AdminUserNotFoundError();
		return this.withoutCredentials(user);
	}

	async ban(userId: string, actorId: string, input: BanBody) {
		if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
			throw new InvalidBanExpiryError();
		}
		const result = await this.repository.banUser(
			userId,
			actorId,
			input.reason,
			input.expiresAt ?? null,
		);
		if (result.outcome === "NOT_FOUND") throw new AdminUserNotFoundError();
		if (result.outcome === "PROTECTED") throw new ProtectedAdminBanError();
		if (result.outcome === "ACTIVE") throw new ActiveBanConflictError();
		await this.publishRevocation(userId);
		return result.ban;
	}

	async unban(userId: string, actorId: string) {
		const user = await this.repository.unbanUser(userId, actorId);
		if (!user) throw new AdminUserNotFoundError();
		return { userId };
	}

	async reconcileNotifications() {
		const events = await this.repository.findPendingNotifications();
		for (const event of events) {
			await this.queueDecisionNotification({
				eventId: event.id,
				userId: event.userId,
				email: event.user.email,
				firstName: event.user.firstName,
				status: event.newStatus as "VERIFIED" | "REJECTED",
				reason: event.reason,
			});
		}
		return events.length;
	}

	private async queueDecisionNotification(decision: ReviewDecisionResult) {
		await this.repository.markNotificationQueued(decision.eventId);
		try {
			await this.emailService.sendAlumniDecision({
				eventId: decision.eventId,
				to: decision.email,
				firstName: decision.firstName,
				status: decision.status,
				reason: decision.reason,
			});
		} catch (error) {
			await this.repository.markNotificationFailed(
				decision.eventId,
				error instanceof Error ? error.message : "Unable to enqueue email",
			);
		}
	}

	private async publishRevocation(userId: string) {
		try {
			await this.revocations.publish(userId);
		} catch {
			// Database-backed guards remain authoritative if Redis is unavailable.
		}
	}

	private withoutCredentials<
		T extends { passwordHash: string | null; googleId: string | null },
	>(user: T): Omit<T, "passwordHash" | "googleId"> {
		const { passwordHash: _passwordHash, googleId: _googleId, ...safe } = user;
		return safe;
	}
}
