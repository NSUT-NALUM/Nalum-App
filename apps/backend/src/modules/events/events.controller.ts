import type { FastifyReply, FastifyRequest } from "fastify";
import BadRequestError from "../../errors/bad-request.error";
import { getCurrentUser } from "../../middlewares/auth.middleware";
import { EVENT_IMAGE_UPLOAD_PREFIX } from "../storage/storage.keys";
import {
	type EventFields,
	eventFieldsSchema,
	type EventIdParams,
	eventUpdateFieldsSchema,
	type EventsQuery,
	type ModerationEventsQuery,
	type ModerationNote,
	type RejectionBody,
} from "./events.schema";
import type { EventsService } from "./events.service";

export class EventsController {
	constructor(private readonly service: EventsService) {}

	create = async (request: FastifyRequest, reply: FastifyReply) => {
		const actor = getCurrentUser(request);
		const eventId = crypto.randomUUID();
		const { fields, imageKeys } = await this.readMultipart(request, eventId);
		const input = eventFieldsSchema.parse(fields);
		const event = await this.service.create(
			{
				...input,
				id: eventId,
				authorId: actor.id,
				imageKeys,
				status: actor.role === "ADMIN" ? "PUBLISHED" : "PENDING",
			},
			actor,
		);
		return reply.success(event, "Event created successfully", 201);
	};

	list = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.listPublished(request.query as EventsQuery, getCurrentUser(request).id));

	mine = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.listMine(getCurrentUser(request), request.query as EventsQuery));

	get = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.get((request.params as EventIdParams).eventId, getCurrentUser(request)));

	update = async (request: FastifyRequest, reply: FastifyReply) => {
		const eventId = (request.params as EventIdParams).eventId;
		const { fields, imageKeys, hasImages } = await this.readMultipart(request, eventId);
		const input = eventUpdateFieldsSchema.parse(fields);
		return reply.success(
			await this.service.update(eventId, hasImages ? { ...input, imageKeys } : input, getCurrentUser(request)),
			"Event updated successfully",
		);
	};

	delete = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.delete((request.params as EventIdParams).eventId, getCurrentUser(request)), "Event deleted successfully");

	cancel = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.cancel((request.params as EventIdParams).eventId, getCurrentUser(request)), "Event cancelled successfully");

	join = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.join((request.params as EventIdParams).eventId, getCurrentUser(request).id), "Joined event successfully", 201);

	leave = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.leave((request.params as EventIdParams).eventId, getCurrentUser(request).id), "Left event successfully");

	attendees = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.listAttendees((request.params as EventIdParams).eventId, getCurrentUser(request), request.query as EventsQuery));

	moderationList = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.listForModeration(request.query as ModerationEventsQuery, getCurrentUser(request)));

	approve = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.approve((request.params as EventIdParams).eventId, getCurrentUser(request), (request.body as ModerationNote).note), "Event approved successfully");

	reject = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.reject((request.params as EventIdParams).eventId, getCurrentUser(request), (request.body as RejectionBody).reason), "Event rejected successfully");

	private async readMultipart(request: FastifyRequest, eventId: string) {
		if (!request.isMultipart()) throw new BadRequestError("Multipart request expected", "MULTIPART_REQUIRED");
		const fields: Partial<Record<keyof EventFields, string>> = {};
		const imageKeys: string[] = [];
		let hasImages = false;
		for await (const part of request.parts()) {
			if (part.type === "file") {
				if (part.fieldname !== "images" && part.fieldname !== "images[]") continue;
				hasImages = true;
				if (imageKeys.length === 10) throw new BadRequestError("A maximum of 10 event images is allowed", "TOO_MANY_EVENT_IMAGES");
				const upload = await request.server.storage.uploadImage({ filename: part.filename, mimetype: part.mimetype, toBuffer: async () => part.toBuffer() }, [EVENT_IMAGE_UPLOAD_PREFIX, eventId]);
				imageKeys.push(upload.key);
			} else if (part.fieldname in eventFieldsSchema.shape) {
				fields[part.fieldname as keyof EventFields] = part.value as string;
			}
		}
		return { fields, imageKeys, hasImages };
	}
}
