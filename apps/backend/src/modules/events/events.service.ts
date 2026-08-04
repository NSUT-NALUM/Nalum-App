import { env } from "../../config/env.config";
import ConflictError from "../../errors/conflict.error";
import { enqueueEmail } from "../../queues/email.queue";
import { toStorageObjectUrl } from "../storage/storage.keys";
import {
	EventForbiddenError,
	EventNotFoundError,
	EventRegistrationConflictError,
	EventScheduleError,
	EventStateConflictError,
} from "./events.errors";
import type { EventsRepository } from "./events.repository";
import type { EventsQuery, ModerationEventsQuery } from "./events.schema";
import type {
	EventActor,
	EventCreateInput,
	EventPatchInput,
} from "./events.types";

export class EventsService {
	constructor(private readonly repository: EventsRepository) {}

	async create(input: EventCreateInput, actor: EventActor) {
		this.assertEventCreator(actor);
		this.assertSchedule(input.startsAt, input.endsAt);
		const event = await this.repository.create(input);
		const notificationEmail = env.EVENTS_NOTIFICATION_EMAIL;
		if (notificationEmail)
			void enqueueEmail(
				"event-notification",
				{
					eventId: event.id,
					to: notificationEmail,
					authorName: `${event.author.firstName} ${event.author.lastName}`,
					authorEmail: event.author.email,
					title: event.title,
					startsAt: event.startsAt.toISOString(),
					endsAt: event.endsAt.toISOString(),
					status: event.status === "PUBLISHED" ? "PUBLISHED" : "PENDING",
				},
				`event-created-${event.id}`,
			).catch(() => undefined);
		const { author, imageKeys, ...data } = event;
		return {
			...data,
			author: {
				id: author.id,
				firstName: author.firstName,
				lastName: author.lastName,
			},
			images: imageKeys.map(toStorageObjectUrl),
			attendeeCount: 0,
			isJoined: false,
		};
	}

	async listPublished(filters: EventsQuery, viewerId: string) {
		const result = await this.repository.listPublished(filters, viewerId);
		return {
			...result,
			events: result.events.map((event) => this.toEvent(event)),
		};
	}

	async listMine(actor: EventActor, filters: EventsQuery) {
		this.assertEventCreator(actor);
		const result = await this.repository.listMine(actor.id, filters, actor.id);
		return {
			...result,
			events: result.events.map((event) => this.toEvent(event)),
		};
	}

	async get(eventId: string, actor: EventActor) {
		const event = await this.repository.findById(eventId, actor.id);
		if (
			!event ||
			(event.status !== "PUBLISHED" && !this.canManage(actor, event.authorId))
		) {
			throw new EventNotFoundError();
		}
		return this.toEvent(event);
	}

	async update(eventId: string, data: EventPatchInput, actor: EventActor) {
		const event = await this.requireManageable(eventId, actor, false);
		this.assertSchedule(
			data.startsAt ?? event.startsAt,
			data.endsAt ?? event.endsAt,
		);
		const updated = await this.repository.update(
			eventId,
			actor.role === "ADMIN"
				? data
				: {
						...data,
						status: "PENDING",
						reviewerId: null,
						moderationNote: null,
						rejectionReason: null,
					},
			actor.id,
		);
		if (actor.role !== "ADMIN") {
			this.notifyModerators(updated, actor, "resubmitted");
		}
		return this.toEvent(updated);
	}

	async delete(eventId: string, actor: EventActor) {
		await this.requireManageable(eventId, actor, true);
		await this.repository.delete(eventId);
		return { eventId };
	}

	async cancel(eventId: string, actor: EventActor) {
		if (actor.role !== "ADMIN") throw new EventForbiddenError();
		const result = await this.repository.cancel(eventId, actor.id);
		if (result.count !== 1) throw new EventStateConflictError();
		return { eventId, status: "CANCELLED" as const };
	}

	async join(eventId: string, userId: string) {
		const event = await this.repository.findById(eventId, userId);
		if (!event) throw new EventNotFoundError();
		if (
			event.status !== "PUBLISHED" ||
			event.startsAt.getTime() <= Date.now()
		) {
			throw new EventStateConflictError("This event is not open for RSVP");
		}
		try {
			await this.repository.join(eventId, userId);
		} catch (error) {
			if (this.isUniqueConstraint(error))
				throw new EventRegistrationConflictError();
			throw error;
		}
		return { eventId, isJoined: true };
	}

	async leave(eventId: string, userId: string) {
		const result = await this.repository.leave(eventId, userId);
		if (result.count !== 1) {
			throw new ConflictError(
				"You have not joined this event",
				"EVENT_NOT_JOINED",
			);
		}
		return { eventId, isJoined: false };
	}

	async listAttendees(
		eventId: string,
		actor: EventActor,
		filters: EventsQuery,
	) {
		const event = await this.repository.findById(eventId, actor.id);
		if (!event) throw new EventNotFoundError();
		if (!this.canManage(actor, event.authorId)) throw new EventForbiddenError();
		return this.repository.listAttendees(
			eventId,
			filters.limit,
			filters.offset,
		);
	}

	async listForModeration(filters: ModerationEventsQuery, actor: EventActor) {
		if (actor.role !== "ADMIN") throw new EventForbiddenError();
		const result = await this.repository.listForModeration(filters, actor.id);
		return {
			...result,
			events: result.events.map((event) => this.toEvent(event)),
		};
	}

	async approve(eventId: string, actor: EventActor, note?: string) {
		if (actor.role !== "ADMIN") throw new EventForbiddenError();
		const result = await this.repository.moderate(
			eventId,
			actor.id,
			"PUBLISHED",
			note ?? null,
		);
		if (result.count !== 1) throw new EventStateConflictError();
		return { eventId, status: "PUBLISHED" as const };
	}

	async reject(eventId: string, actor: EventActor, reason: string) {
		if (actor.role !== "ADMIN") throw new EventForbiddenError();
		const result = await this.repository.moderate(
			eventId,
			actor.id,
			"REJECTED",
			reason,
		);
		if (result.count !== 1) throw new EventStateConflictError();
		return { eventId, status: "REJECTED" as const };
	}

	private async requireManageable(
		eventId: string,
		actor: EventActor,
		pendingOnlyForAuthor: boolean,
	) {
		const event = await this.repository.findById(eventId, actor.id);
		if (!event) throw new EventNotFoundError();
		if (actor.role === "ADMIN") return event;
		if (
			event.authorId !== actor.id ||
			(pendingOnlyForAuthor && event.status !== "PENDING") ||
			event.status === "CANCELLED"
		) {
			throw new EventForbiddenError();
		}
		return event;
	}

	private assertEventCreator(actor: EventActor) {
		if (
			actor.role !== "ADMIN" &&
			actor.role !== "PROFESSOR" &&
			(actor.role !== "ALUMNI" || actor.verificationStatus !== "VERIFIED")
		) {
			throw new EventForbiddenError();
		}
	}

	private canManage(actor: EventActor, authorId: string) {
		return actor.role === "ADMIN" || actor.id === authorId;
	}

	private assertSchedule(startsAt: Date, endsAt: Date) {
		if (endsAt.getTime() <= startsAt.getTime()) throw new EventScheduleError();
	}

	private isUniqueConstraint(error: unknown) {
		return (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "P2002"
		);
	}

	private notifyModerators(
		event: {
			id: string;
			title: string;
			startsAt: Date;
			endsAt: Date;
			status: "PENDING" | "PUBLISHED" | "REJECTED" | "CANCELLED";
		},
		actor: EventActor,
		reason: "created" | "resubmitted",
	) {
		const notificationEmail = env.EVENTS_NOTIFICATION_EMAIL;
		if (!notificationEmail || !actor.email) return;
		void enqueueEmail(
			"event-notification",
			{
				eventId: event.id,
				to: notificationEmail,
				authorName:
					`${actor.firstName ?? "Publisher"} ${actor.lastName ?? ""}`.trim(),
				authorEmail: actor.email,
				title: event.title,
				startsAt: event.startsAt.toISOString(),
				endsAt: event.endsAt.toISOString(),
				status: event.status === "PUBLISHED" ? "PUBLISHED" : "PENDING",
			},
			`event-${reason}-${event.id}-${Date.now()}`,
		).catch(() => undefined);
	}

	private toEvent<
		T extends {
			imageKeys: string[];
			registrations: unknown[];
			_count: { registrations: number };
		},
	>(event: T) {
		const { imageKeys, registrations, _count, ...data } = event;
		return {
			...data,
			images: imageKeys.map(toStorageObjectUrl),
			attendeeCount: _count.registrations,
			isJoined: registrations.length > 0,
		};
	}
}
