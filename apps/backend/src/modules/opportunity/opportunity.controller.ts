import type { FastifyReply, FastifyRequest } from "fastify";
import { getCurrentUser } from "../../middlewares/auth.middleware";
import {
	type ModerationOpportunitiesQuery,
	type OpportunityFields,
	type OpportunityIdParams,
	type OpportunityModerationNote,
	type OpportunityPageQuery,
	type OpportunityRejection,
	type OpportunityUpdate,
	opportunityFieldsSchema,
	opportunityUpdateSchema,
} from "./opportunity.schema";
import type { OpportunityService } from "./opportunity.service";

export class OpportunityController {
	constructor(private readonly service: OpportunityService) {}

	create = async (request: FastifyRequest, reply: FastifyReply) => {
		const actor = getCurrentUser(request);
		const input = opportunityFieldsSchema.parse(
			request.body,
		) as OpportunityFields;
		return reply.success(
			await this.service.create(
				{
					...input,
					id: crypto.randomUUID(),
					authorId: actor.id,
					status: actor.role === "ADMIN" ? "PUBLISHED" : "PENDING",
				},
				actor,
			),
			"Opportunity created successfully",
			201,
		);
	};

	list = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.listPublished(
				request.query as OpportunityPageQuery,
				getCurrentUser(request),
			),
		);

	mine = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.listMine(
				request.query as OpportunityPageQuery,
				getCurrentUser(request),
			),
		);

	get = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.get(
				(request.params as OpportunityIdParams).opportunityId,
				getCurrentUser(request),
			),
		);

	update = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.update(
				(request.params as OpportunityIdParams).opportunityId,
				opportunityUpdateSchema.parse(request.body) as OpportunityUpdate,
				getCurrentUser(request),
			),
			"Opportunity updated successfully",
		);

	moderationList = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.listForModeration(
				request.query as ModerationOpportunitiesQuery,
				getCurrentUser(request),
			),
		);

	approve = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.approve(
				(request.params as OpportunityIdParams).opportunityId,
				getCurrentUser(request),
				(request.body as OpportunityModerationNote).note,
			),
			"Opportunity approved successfully",
		);

	reject = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.reject(
				(request.params as OpportunityIdParams).opportunityId,
				getCurrentUser(request),
				(request.body as OpportunityRejection).reason,
			),
			"Opportunity rejected successfully",
		);
}
