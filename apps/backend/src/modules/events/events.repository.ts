import type {
	EventStatus,
	Prisma,
	PrismaClient,
} from "../../database/prisma/generated/client";
import type { EventsQuery, ModerationEventsQuery } from "./events.schema";
import type { EventCreateInput, EventPatchInput } from "./events.types";

const eventInclude = (viewerId: string) =>
	({
		author: { select: { id: true, firstName: true, lastName: true } },
		reviewer: { select: { id: true, firstName: true, lastName: true } },
		registrations: { where: { userId: viewerId }, select: { userId: true } },
		_count: { select: { registrations: true } },
	}) satisfies Prisma.EventInclude;

export class EventsRepository {
	constructor(private readonly prisma: PrismaClient) {}

	create(input: EventCreateInput) {
		return this.prisma.event.create({
			data: input,
			include: {
				author: { select: { id: true, firstName: true, lastName: true, email: true } },
			},
		});
	}

	findById(eventId: string, viewerId: string) {
		return this.prisma.event.findUnique({
			where: { id: eventId },
			include: eventInclude(viewerId),
		});
	}

	async listPublished(filters: EventsQuery, viewerId: string) {
		const now = new Date();
		const startsFrom = [
			filters.when === "upcoming" ? now : undefined,
			filters.startsFrom,
		].reduce<Date | undefined>(
			(latest, value) => (!latest || (value && value > latest) ? value : latest),
			undefined,
		);
		const where: Prisma.EventWhereInput = {
			status: "PUBLISHED",
			startsAt: {
				...(startsFrom ? { gte: startsFrom } : {}),
				...(filters.when === "past" ? { lt: now } : {}),
				...(filters.startsTo ? { lte: filters.startsTo } : {}),
			},
		};
		const [events, total] = await this.prisma.$transaction([
			this.prisma.event.findMany({
				where,
				include: eventInclude(viewerId),
				orderBy: [{ startsAt: filters.when === "upcoming" ? "asc" : "desc" }, { id: "asc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.event.count({ where }),
		]);
		return { events, total, limit: filters.limit, offset: filters.offset };
	}

	async listMine(authorId: string, filters: EventsQuery, viewerId: string) {
		const where: Prisma.EventWhereInput = { authorId };
		const [events, total] = await this.prisma.$transaction([
			this.prisma.event.findMany({
				where,
				include: eventInclude(viewerId),
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.event.count({ where }),
		]);
		return { events, total, limit: filters.limit, offset: filters.offset };
	}

	update(eventId: string, data: EventPatchInput, viewerId: string) {
		return this.prisma.event.update({
			where: { id: eventId },
			data,
			include: eventInclude(viewerId),
		});
	}

	delete(eventId: string) {
		return this.prisma.event.delete({ where: { id: eventId } });
	}

	cancel(eventId: string, reviewerId: string) {
		return this.prisma.event.updateMany({
			where: { id: eventId, status: { in: ["PENDING", "PUBLISHED"] } },
			data: { status: "CANCELLED", reviewerId },
		});
	}

	join(eventId: string, userId: string) {
		return this.prisma.eventRegistration.create({ data: { eventId, userId } });
	}

	leave(eventId: string, userId: string) {
		return this.prisma.eventRegistration.deleteMany({ where: { eventId, userId } });
	}

	async listAttendees(eventId: string, limit: number, offset: number) {
		const where = { eventId };
		const [registrations, total] = await this.prisma.$transaction([
			this.prisma.eventRegistration.findMany({
				where,
				include: {
					user: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							profile: { select: { batch: true, branch: true, campus: true } },
						},
					},
				},
				orderBy: [{ createdAt: "desc" }, { userId: "asc" }],
				take: limit,
				skip: offset,
			}),
			this.prisma.eventRegistration.count({ where }),
		]);
		return { attendees: registrations.map(({ user, createdAt }) => ({ ...user, joinedAt: createdAt })), total, limit, offset };
	}

	async listForModeration(filters: ModerationEventsQuery, viewerId: string) {
		const where: Prisma.EventWhereInput = {
			status: filters.status as EventStatus,
			...(filters.authorId ? { authorId: filters.authorId } : {}),
			...(filters.startsFrom || filters.startsTo
				? { startsAt: { ...(filters.startsFrom ? { gte: filters.startsFrom } : {}), ...(filters.startsTo ? { lte: filters.startsTo } : {}) } }
				: {}),
			...(filters.q
				? { OR: [{ title: { contains: filters.q, mode: "insensitive" } }, { description: { contains: filters.q, mode: "insensitive" } }, { venue: { contains: filters.q, mode: "insensitive" } }] }
				: {}),
		};
		const [events, total] = await this.prisma.$transaction([
			this.prisma.event.findMany({ where, include: eventInclude(viewerId), orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: filters.limit, skip: filters.offset }),
			this.prisma.event.count({ where }),
		]);
		return { events, total, limit: filters.limit, offset: filters.offset };
	}

	moderate(eventId: string, reviewerId: string, status: "PUBLISHED" | "REJECTED", note: string | null) {
		return this.prisma.event.updateMany({
			where: { id: eventId, status: "PENDING" },
			data: status === "PUBLISHED"
				? { status, reviewerId, moderationNote: note, rejectionReason: null }
				: { status, reviewerId, rejectionReason: note, moderationNote: null },
		});
	}
}
