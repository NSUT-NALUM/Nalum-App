import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	requirePlatformAccess,
	requirePublisherAccess,
} from "../../middlewares/auth.middleware";
import { OpportunityController } from "./opportunity.controller";
import { OpportunityRepository } from "./opportunity.repository";
import * as schema from "./opportunity.schema";
import { OpportunityService } from "./opportunity.service";

const opportunityRoutes: FastifyPluginAsync = async (fastify) => {
	const controller = new OpportunityController(
		new OpportunityService(new OpportunityRepository(fastify.prisma)),
	);
	const app = fastify.withTypeProvider<ZodTypeProvider>();
	const member = {
		preHandler: requirePlatformAccess,
		schema: {
			tags: ["Opportunities"],
			security: [{ bearerAuth: [] }],
			response: { 200: schema.opportunityResponseSchema },
		},
	};
	const publisher = { ...member, preHandler: requirePublisherAccess };

	app.post(
		"/",
		{
			...publisher,
			schema: {
				...publisher.schema,
				body: schema.opportunityFieldsSchema,
				response: { 201: schema.opportunityResponseSchema },
			},
		},
		controller.create,
	);
	app.get(
		"/",
		{
			...member,
			schema: {
				...member.schema,
				querystring: schema.opportunityPageQuerySchema,
			},
		},
		controller.list,
	);
	app.get(
		"/mine",
		{
			...publisher,
			schema: {
				...publisher.schema,
				querystring: schema.opportunityPageQuerySchema,
			},
		},
		controller.mine,
	);
	app.get(
		"/:opportunityId",
		{
			...publisher,
			schema: {
				...publisher.schema,
				params: schema.opportunityIdParamsSchema,
			},
		},
		controller.get,
	);
	app.patch(
		"/:opportunityId",
		{
			...publisher,
			schema: {
				...publisher.schema,
				params: schema.opportunityIdParamsSchema,
				body: schema.opportunityUpdateSchema,
			},
		},
		controller.update,
	);
};

export default opportunityRoutes;
