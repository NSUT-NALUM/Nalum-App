import { describe, expect, it, vi } from "vitest";
import {
	ProtectedAdminBanError,
	ReviewDecisionConflictError,
} from "./admin.errors";
import { AdminService } from "./admin.service";

const createService = () => {
	const repository = {
		decideApplication: vi.fn(),
		markNotificationQueued: vi.fn(),
		markNotificationFailed: vi.fn(),
		reopenApplication: vi.fn(),
		banUser: vi.fn(),
	};
	const email = { sendAlumniDecision: vi.fn() };
	const revocations = { publish: vi.fn() };
	return {
		repository,
		email,
		revocations,
		service: new AdminService(repository as never, email as never, revocations),
	};
};

describe("AdminService", () => {
	it("rejects a stale concurrent approval", async () => {
		const { repository, service } = createService();
		repository.decideApplication.mockResolvedValue(null);
		await expect(
			service.approve(crypto.randomUUID(), crypto.randomUUID()),
		).rejects.toBeInstanceOf(ReviewDecisionConflictError);
	});

	it("queues a deterministic decision notification after approval", async () => {
		const { repository, email, service } = createService();
		const decision = {
			eventId: crypto.randomUUID(),
			userId: crypto.randomUUID(),
			email: "alumni@example.com",
			firstName: "Alumni",
			status: "VERIFIED" as const,
			reason: "Welcome",
		};
		repository.decideApplication.mockResolvedValue(decision);
		await service.approve(decision.userId, crypto.randomUUID(), "Welcome");
		expect(repository.markNotificationQueued).toHaveBeenCalledWith(
			decision.eventId,
		);
		expect(email.sendAlumniDecision).toHaveBeenCalledWith(
			expect.objectContaining({ eventId: decision.eventId }),
		);
	});

	it("publishes access revocation after rejection", async () => {
		const { repository, revocations, service } = createService();
		const userId = crypto.randomUUID();
		repository.decideApplication.mockResolvedValue({
			eventId: crypto.randomUUID(),
			userId,
			email: "alumni@example.com",
			firstName: "Alumni",
			status: "REJECTED",
			reason: "Details do not match",
		});
		await service.reject(userId, crypto.randomUUID(), "Details do not match");
		expect(revocations.publish).toHaveBeenCalledWith(userId);
	});

	it("does not allow administrator bans", async () => {
		const { repository, service } = createService();
		repository.banUser.mockResolvedValue({ outcome: "PROTECTED" });
		await expect(
			service.ban(crypto.randomUUID(), crypto.randomUUID(), {
				reason: "No",
			}),
		).rejects.toBeInstanceOf(ProtectedAdminBanError);
	});
});
