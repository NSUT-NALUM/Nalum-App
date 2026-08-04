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

const createRepository = () => ({
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
		vi.clearAllMocks();
		repository = createRepository();
		service = new EventsService(repository as never);
		enqueueEmail.mockResolvedValue(undefined);
	});

	it("allows professors to create events", async () => {
		const professor = actor({ role: "PROFESSOR", verificationStatus: null });
		const input = {
			...event({ authorId: professor.id }),
			title: "Talk",
			description: "Desc",
			venue: "Hall",
			imageKeys: [],
			status: "PENDING" as const,
		};
		repository.create.mockResolvedValue({
			...input,
			author: {
				id: professor.id,
				firstName: "Prof",
				lastName: "Essor",
				email: "prof@example.test",
			},
		});

		await expect(service.create(input, professor)).resolves.toMatchObject({
			title: "Talk",
		});
	});

	it("rejects unverified alumni event creation", async () => {
		await expect(
			service.create(
				{
					...event(),
					title: "Talk",
					description: "Desc",
					venue: "Hall",
					imageKeys: [],
					status: "PENDING",
				},
				actor({ verificationStatus: "PENDING" }),
			),
		).rejects.toBeInstanceOf(EventForbiddenError);
	});

	it("rejects an invalid event schedule before persistence", async () => {
		const startsAt = new Date();
		await expect(
			service.create(
				{
					...event({ startsAt, endsAt: startsAt }),
					title: "Talk",
					description: "Desc",
					venue: "Hall",
					imageKeys: [],
					status: "PENDING",
				},
				actor(),
			),
		).rejects.toBeInstanceOf(EventScheduleError);
	});

	it("queues deterministic notifications for submitted and published events", async () => {
		repository.create.mockImplementation(async (input: EventCreateInput) => ({
			...input,
			author: {
				id: input.authorId,
				firstName: "Alice",
				lastName: "Alumni",
				email: "alice@example.test",
			},
		}));
		const alumniId = crypto.randomUUID();
		const adminId = crypto.randomUUID();
		const input = (
			id: string,
			authorId: string,
			status: "PENDING" | "PUBLISHED",
		) => ({
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

		await service.create(
			input(submittedId, alumniId, "PENDING"),
			actor({ id: alumniId }),
		);
		await service.create(
			input(publishedId, adminId, "PUBLISHED"),
			actor({ id: adminId, role: "ADMIN" }),
		);

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

	it("resubmits published alumni edits without clearing RSVPs", async () => {
		const user = actor();
		const current = event({ authorId: user.id, status: "PUBLISHED" });
		repository.findById.mockResolvedValue(current);
		repository.update.mockResolvedValue({ ...current, status: "PENDING" });

		await service.update(current.id, { title: "Revised" }, user);

		expect(repository.update).toHaveBeenCalledWith(
			current.id,
			expect.objectContaining({ title: "Revised", status: "PENDING" }),
			user.id,
		);
	});

	it("cancels only pending or published events", async () => {
		repository.cancel.mockResolvedValue({ count: 0 });
		await expect(
			service.cancel(crypto.randomUUID(), actor({ role: "ADMIN" })),
		).rejects.toBeInstanceOf(EventStateConflictError);
	});

	it("converts duplicate RSVPs into a conflict", async () => {
		repository.findById.mockResolvedValue(event({ status: "PUBLISHED" }));
		repository.join.mockRejectedValue({ code: "P2002" });
		await expect(
			service.join(crypto.randomUUID(), crypto.randomUUID()),
		).rejects.toBeInstanceOf(EventRegistrationConflictError);
	});

	it("rejects RSVP for a past or unpublished event", async () => {
		repository.findById.mockResolvedValue(
			event({ status: "PUBLISHED", startsAt: new Date(Date.now() - 1) }),
		);
		await expect(
			service.join(crypto.randomUUID(), crypto.randomUUID()),
		).rejects.toBeInstanceOf(EventStateConflictError);
	});

	it("only approves pending submissions", async () => {
		repository.moderate.mockResolvedValue({ count: 0 });
		await expect(
			service.approve(crypto.randomUUID(), actor({ role: "ADMIN" })),
		).rejects.toBeInstanceOf(EventStateConflictError);
	});
});
