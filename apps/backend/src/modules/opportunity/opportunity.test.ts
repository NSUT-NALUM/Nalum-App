import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	OpportunityForbiddenError,
	OpportunityNotFoundError,
} from "./opportunity.errors";
import { opportunityFieldsSchema } from "./opportunity.schema";
import { OpportunityService } from "./opportunity.service";
import type { OpportunityActor } from "./opportunity.types";

const { enqueueEmail } = vi.hoisted(() => ({ enqueueEmail: vi.fn() }));

vi.mock("../../config/env.config", () => ({
	env: { EVENTS_NOTIFICATION_EMAIL: "events@example.test" },
}));
vi.mock("../../queues/email.queue", () => ({ enqueueEmail }));

const actor = (
	overrides: Partial<OpportunityActor> = {},
): OpportunityActor => ({
	id: crypto.randomUUID(),
	role: "VISITOR",
	verificationStatus: null,
	firstName: "Vis",
	lastName: "Itor",
	email: "visitor@example.test",
	...overrides,
});

const opportunity = (overrides = {}) => ({
	id: crypto.randomUUID(),
	roleTitle: "Software intern",
	organization: "Nalum",
	description: "Build useful things.",
	type: "INTERNSHIP" as const,
	workMode: "HYBRID" as const,
	location: "Delhi",
	deadline: new Date("2026-08-10T18:29:59.999Z"),
	applicationUrl: "https://example.test/apply",
	status: "PENDING" as const,
	authorId: crypto.randomUUID(),
	reviewerId: null,
	moderationNote: null,
	rejectionReason: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	author: { id: crypto.randomUUID(), firstName: "Ada", lastName: "Publisher" },
	reviewer: null,
	...overrides,
});

const repository = () => ({
	create: vi.fn(),
	findById: vi.fn(),
	findForDecision: vi.fn(),
	listPublished: vi.fn(),
	listMine: vi.fn(),
	update: vi.fn(),
	listForModeration: vi.fn(),
	moderate: vi.fn(),
});

describe("OpportunityService", () => {
	let repo: ReturnType<typeof repository>;
	let service: OpportunityService;

	beforeEach(() => {
		repo = repository();
		service = new OpportunityService(repo as never);
		enqueueEmail.mockResolvedValue(undefined);
	});

	it("keeps visitor publisher output free of member identities", async () => {
		const visitor = actor();
		const current = opportunity({ authorId: visitor.id });
		repo.create.mockResolvedValue(current);

		const result = await service.create(
			{
				...current,
				status: "PENDING",
			},
			visitor,
		);

		expect(result).toMatchObject({ id: current.id, deadline: "2026-08-10" });
		expect(result).not.toHaveProperty("author");
		expect(result).not.toHaveProperty("authorId");
	});

	it("rejects Professor browsing and hides expired offers", async () => {
		await expect(
			service.listPublished(
				{ limit: 20, offset: 0 },
				actor({ role: "PROFESSOR" }),
			),
		).rejects.toBeInstanceOf(OpportunityForbiddenError);

		const student = actor({ role: "STUDENT" });
		repo.findById.mockResolvedValue(
			opportunity({ status: "PUBLISHED", deadline: new Date(Date.now() - 1) }),
		);
		await expect(
			service.get(crypto.randomUUID(), student),
		).rejects.toBeInstanceOf(OpportunityNotFoundError);
	});

	it("allows visitors, verified alumni, and admins to publish", async () => {
		const current = opportunity();
		repo.create.mockResolvedValue(current);
		const input = { ...current, status: "PENDING" as const };

		for (const publisher of [
			actor(),
			actor({ role: "ALUMNI", verificationStatus: "VERIFIED" }),
			actor({ role: "ADMIN" }),
		]) {
			await expect(service.create(input, publisher)).resolves.toMatchObject({
				id: current.id,
			});
		}
		await expect(
			service.create(input, actor({ role: "STUDENT" })),
		).rejects.toBeInstanceOf(OpportunityForbiddenError);
	});

	it("validates HTTPS links and turns a calendar day into an inclusive IST deadline", () => {
		const valid = opportunityFieldsSchema.parse({
			roleTitle: "Software intern",
			organization: "Nalum",
			description: "Build useful things.",
			type: "INTERNSHIP",
			workMode: "REMOTE",
			location: "Anywhere",
			deadline: "2026-08-10",
			applicationUrl: "https://example.test/apply",
		});
		expect(valid.deadline.toISOString()).toBe("2026-08-10T18:29:59.999Z");
		expect(
			opportunityFieldsSchema.safeParse({
				...valid,
				applicationUrl: "http://example.test",
			}).success,
		).toBe(false);
	});
});
