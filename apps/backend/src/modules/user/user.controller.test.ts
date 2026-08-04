import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { UserController } from "./user.controller";
import type { UserService } from "./user.service";

describe("UserController", () => {
	it("does not return profile data to a visitor", async () => {
		const getUserDetails = vi.fn().mockResolvedValue({
			id: crypto.randomUUID(),
			role: "VISITOR",
			profile: { city: "Delhi" },
			socialMedia: { linkedin: "https://example.test" },
			experiences: [{ company: "Nalum" }],
			latestReviewReason: "A note",
		});
		const success = vi.fn();
		const controller = new UserController({
			getUserDetails,
		} as unknown as UserService);
		const request = {
			currentUser: { id: crypto.randomUUID(), role: "VISITOR" },
		} as unknown as FastifyRequest;
		const reply = { success } as unknown as FastifyReply;

		await controller.getCurrentUser(request, reply);

		expect(success).toHaveBeenCalledWith(
			expect.objectContaining({
				profile: null,
				socialMedia: null,
				experiences: [],
				latestReviewReason: null,
			}),
			expect.any(String),
		);
	});
});
