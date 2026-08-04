import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requirePlatformAccess } from "../../middlewares/auth.middleware";
import { EventsController } from "./events.controller";
import { EventsRepository } from "./events.repository";
import * as schema from "./events.schema";
import { EventsService } from "./events.service";

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
	const service = new EventsService(new EventsRepository(fastify.prisma));
	const controller = new EventsController(service);
	const app = fastify.withTypeProvider<ZodTypeProvider>();
	const signedIn = {
		preHandler: requirePlatformAccess,
		schema: {
			tags: ["Events"],
			security: [{ bearerAuth: [] }],
			response: { 200: schema.eventsResponseSchema },
		},
	};
	const creator = signedIn;
	const multipart = {
		...creator,
		validatorCompiler: () => () => true,
		schema: {
			...creator.schema,
			consumes: ["multipart/form-data"],
			body: schema.eventMultipartSchema,
		},
	};

	app.post(
		"/",
		{
			...multipart,
			schema: {
				...multipart.schema,
				response: { 201: schema.eventsResponseSchema },
			},
		},
		controller.create,
	);
	app.get(
		"/",
		{
			...signedIn,
			schema: { ...signedIn.schema, querystring: schema.eventsQuerySchema },
		},
		controller.list,
	);
	app.get(
		"/mine",
		{
			...creator,
			schema: { ...creator.schema, querystring: schema.eventsQuerySchema },
		},
		controller.mine,
	);
	app.get(
		"/:eventId",
		{
			...signedIn,
			schema: { ...signedIn.schema, params: schema.eventIdParamsSchema },
		},
		controller.get,
	);
	app.patch(
		"/:eventId",
		{
			...multipart,
			schema: { ...multipart.schema, params: schema.eventIdParamsSchema },
		},
		controller.update,
	);
	app.delete(
		"/:eventId",
		{
			...creator,
			schema: { ...creator.schema, params: schema.eventIdParamsSchema },
		},
		controller.delete,
	);
	app.post(
		"/:eventId/cancel",
		{
			...creator,
			schema: { ...creator.schema, params: schema.eventIdParamsSchema },
		},
		controller.cancel,
	);
	app.post(
		"/:eventId/join",
		{
			...signedIn,
			schema: {
				...signedIn.schema,
				params: schema.eventIdParamsSchema,
				response: { 201: schema.eventsResponseSchema },
			},
		},
		controller.join,
	);
	app.delete(
		"/:eventId/join",
		{
			...signedIn,
			schema: { ...signedIn.schema, params: schema.eventIdParamsSchema },
		},
		controller.leave,
	);
	app.get(
		"/:eventId/attendees",
		{
			...creator,
			schema: {
				...creator.schema,
				params: schema.eventIdParamsSchema,
				querystring: schema.eventsQuerySchema,
			},
		},
		controller.attendees,
	);
};

export default eventsRoutes;
