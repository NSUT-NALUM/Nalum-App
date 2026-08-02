import { z } from "zod/v4";

const numberQuery = (schema: z.ZodNumber) =>
	z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() !== "" ? Number(value) : value,
		schema,
	);

const pagination = {
	limit: numberQuery(z.number().int().min(1).max(100)).default(25),
	offset: numberQuery(z.number().int().min(0)).default(0),
};

const optionalUrl = z.preprocess(
	(value) => (value === "" ? undefined : value),
	z.url().optional(),
);

export const eventFieldsSchema = z.object({
	title: z.string().trim().min(1).max(200),
	description: z.string().trim().min(1).max(10000),
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
	venue: z.string().trim().min(1).max(500),
	meetUrl: optionalUrl,
});

export const eventUpdateFieldsSchema = eventFieldsSchema.partial().extend({
	meetUrl: z.preprocess(
		(value) => (value === "" ? null : value),
		z.url().nullable().optional(),
	),
});

export const eventIdParamsSchema = z.object({ eventId: z.uuid() });

export const eventsQuerySchema = z.object({
	when: z.enum(["upcoming", "past"]).default("upcoming"),
	startsFrom: z.coerce.date().optional(),
	startsTo: z.coerce.date().optional(),
	...pagination,
});

export const moderationEventsQuerySchema = z.object({
	status: z
		.enum(["PENDING", "PUBLISHED", "REJECTED", "CANCELLED"])
		.default("PENDING"),
	authorId: z.uuid().optional(),
	q: z.string().trim().min(1).optional(),
	startsFrom: z.coerce.date().optional(),
	startsTo: z.coerce.date().optional(),
	...pagination,
});

export const moderationNoteSchema = z.object({
	note: z.string().trim().min(1).max(1000).optional(),
});

export const rejectionSchema = z.object({
	reason: z.string().trim().min(1).max(1000),
});

export const eventsResponseSchema = z.object({
	success: z.literal(true),
	message: z.string(),
	data: z.unknown().nullable(),
});

export const eventMultipartSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	startsAt: z.string().optional(),
	endsAt: z.string().optional(),
	venue: z.string().optional(),
	meetUrl: z.string().optional(),
	images: z.any().optional().meta({ type: "string", format: "binary" }),
});

export type EventFields = z.infer<typeof eventFieldsSchema>;
export type EventUpdateFields = z.infer<typeof eventUpdateFieldsSchema>;
export type EventsQuery = z.infer<typeof eventsQuerySchema>;
export type ModerationEventsQuery = z.infer<typeof moderationEventsQuerySchema>;
export type EventIdParams = z.infer<typeof eventIdParamsSchema>;
export type ModerationNote = z.infer<typeof moderationNoteSchema>;
export type RejectionBody = z.infer<typeof rejectionSchema>;
