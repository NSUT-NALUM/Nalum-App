import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	EventForbiddenError,
	EventRegistrationConflictError,
	EventScheduleError,
	EventStateConflictError,
} from "./events.errors";
import { EventsService } from "./events.service";
import type { EventActor, EventCreateInput } from "./events.types";

const { enqueueEmail } = vi.hoisted(() => ({ enqueueEmail: vi.fn() }));

vi.mock("../../config/env.config", () => ({
	env: { EVENTS_NOTIFICATION_EMAIL: "events@example.test" },
}));
vi.mock("../../queues/email.queue", () => ({ enqueueEmail }));

const actor = (overrides: Partial<EventActor> = {}): EventActor => ({
	id: crypto.randomUUID(),
	role: "ALUMNI",
	verificationStatus: "VERIFIED",
	...overrides,
});

const event = (overrides = {}) => ({
	id: crypto.randomUUID(),
	authorId: crypto.randomUUID(),
	status: "PENDING",
	startsAt: new Date(Date.now() + 60_000),
	endsAt: new Date(Date.now() + 120_000),
	imageKeys: [],
	registrations: [],
	_count: { registrations: 0 },
	...overrides,
});

const createRepository = () =>
	({
		findById: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		cancel: vi.fn(),
		join: vi.fn(),
		leave: vi.fn(),
		moderate: vi.fn(),
		create: vi.fn(),
	});

describe("EventsService", () => {
	let repository: ReturnType<typeof createRepository>;
	let service: EventsService;

	beforeEach(() => {
		repository = createRepository();
		service = new EventsService(repository as never);
		enqueueEmail.mockResolvedValue(undefined);
	});

	it("allows only verified alumni or admins to create events", async () => {
		await expect(
			service.create(
				{ ...event(), title: "Talk", description: "Desc", venue: "Hall", imageKeys: [], status: "PENDING" },
				actor({ verificationStatus: "PENDING" }),
			),
		).rejects.toBeInstanceOf(EventForbiddenError);
	});

	it("rejects an invalid event schedule before persistence", async () => {
		const startsAt = new Date();
		await expect(
			service.create(
				{ ...event({ startsAt, endsAt: startsAt }), title: "Talk", description: "Desc", venue: "Hall", imageKeys: [], status: "PENDING" },
				actor(),
			),
		).rejects.toBeInstanceOf(EventScheduleError);
	});

	it("queues deterministic notifications for submitted and published events", async () => {
		repository.create.mockImplementation(async (input: EventCreateInput) => ({
			...input,
			author: { id: input.authorId, firstName: "Alice", lastName: "Alumni", email: "alice@example.test" },
		}));
		const alumniId = crypto.randomUUID();
		const adminId = crypto.randomUUID();
		const input = (id: string, authorId: string, status: "PENDING" | "PUBLISHED") => ({
			id,
			authorId,
			title: "Career Talk",
			description: "A talk",
			venue: "Hall",
			startsAt: new Date(Date.now() + 60_000),
			endsAt: new Date(Date.now() + 120_000),
			imageKeys: [],
			status,
		});
		const submittedId = crypto.randomUUID();
		const publishedId = crypto.randomUUID();

		await service.create(input(submittedId, alumniId, "PENDING"), actor({ id: alumniId }));
		await service.create(input(publishedId, adminId, "PUBLISHED"), actor({ id: adminId, role: "ADMIN" }));

		expect(enqueueEmail).toHaveBeenNthCalledWith(
			1,
			"event-notification",
			expect.objectContaining({ status: "PENDING" }),
			`event-created-${submittedId}`,
		);
		expect(enqueueEmail).toHaveBeenNthCalledWith(
			2,
			"event-notification",
			expect.objectContaining({ status: "PUBLISHED" }),
			`event-created-${publishedId}`,
		);
	});

	it("restricts alumni edits to their pending events", async () => {
		const user = actor();
		repository.findById.mockResolvedValue(event({ authorId: user.id, status: "PUBLISHED" }));
		await expect(service.update(crypto.randomUUID(), {}, user)).rejects.toBeInstanceOf(EventForbiddenError);
	});

	it("cancels only pending or published events", async () => {
		repository.cancel.mockResolvedValue({ count: 0 });
		await expect(service.cancel(crypto.randomUUID(), actor({ role: "ADMIN" }))).rejects.toBeInstanceOf(EventStateConflictError);
	});

	it("converts duplicate RSVPs into a conflict", async () => {
		repository.findById.mockResolvedValue(event({ status: "PUBLISHED" }));
		repository.join.mockRejectedValue({ code: "P2002" });
		await expect(service.join(crypto.randomUUID(), crypto.randomUUID())).rejects.toBeInstanceOf(EventRegistrationConflictError);
	});

	it("rejects RSVP for a past or unpublished event", async () => {
		repository.findById.mockResolvedValue(event({ status: "PUBLISHED", startsAt: new Date(Date.now() - 1) }));
		await expect(service.join(crypto.randomUUID(), crypto.randomUUID())).rejects.toBeInstanceOf(EventStateConflictError);
	});

	it("only approves pending submissions", async () => {
		repository.moderate.mockResolvedValue({ count: 0 });
		await expect(service.approve(crypto.randomUUID(), actor({ role: "ADMIN" }))).rejects.toBeInstanceOf(EventStateConflictError);
	});
});
