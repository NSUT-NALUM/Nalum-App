import { env } from "../../config/env.config";
import { enqueueEmail } from "../../queues/email.queue";
import {
	OpportunityForbiddenError,
	OpportunityNotFoundError,
	OpportunityStateConflictError,
} from "./opportunity.errors";
import type { OpportunityRepository } from "./opportunity.repository";
import type {
	ModerationOpportunitiesQuery,
	OpportunityPageQuery,
	OpportunityUpdate,
} from "./opportunity.schema";
import type {
	OpportunityActor,
	OpportunityCreateInput,
} from "./opportunity.types";

type OpportunityView = NonNullable<
	Awaited<ReturnType<OpportunityRepository["findById"]>>
>;

export class OpportunityService {
	constructor(private readonly repository: OpportunityRepository) {}

	async create(input: OpportunityCreateInput, actor: OpportunityActor) {
		this.assertPublisher(actor);
		const opportunity = await this.repository.create(input);
		this.notifyModerators(opportunity, actor);
		return this.toOpportunityForActor(opportunity, actor);
	}

	async listPublished(filters: OpportunityPageQuery, actor: OpportunityActor) {
		this.assertReader(actor);
		const result = await this.repository.listPublished(filters);
		return {
			...result,
			opportunities: result.opportunities.map((opportunity) =>
				this.toOpportunity(opportunity),
			),
		};
	}

	async listMine(filters: OpportunityPageQuery, actor: OpportunityActor) {
		this.assertPublisher(actor);
		const result = await this.repository.listMine(actor.id, filters);
		return {
			...result,
			opportunities: result.opportunities.map((opportunity) =>
				this.toOpportunityForActor(opportunity, actor),
			),
		};
	}

	async get(id: string, actor: OpportunityActor) {
		const opportunity = await this.repository.findById(id);
		if (!opportunity) throw new OpportunityNotFoundError();
		if (opportunity.authorId === actor.id) {
			this.assertPublisher(actor);
			return this.toOpportunityForActor(opportunity, actor);
		}
		if (actor.role === "ADMIN") return this.toOpportunity(opportunity);
		this.assertReader(actor);
		if (
			opportunity.status !== "PUBLISHED" ||
			opportunity.deadline.getTime() < Date.now()
		) {
			throw new OpportunityNotFoundError();
		}
		return this.toOpportunity(opportunity);
	}

	async update(id: string, data: OpportunityUpdate, actor: OpportunityActor) {
		this.assertPublisher(actor);
		const current = await this.repository.findById(id);
		if (!current) throw new OpportunityNotFoundError();
		if (current.status === "REMOVED") throw new OpportunityStateConflictError();
		if (actor.role !== "ADMIN" && current.authorId !== actor.id) {
			throw new OpportunityForbiddenError();
		}
		const updated = await this.repository.update(
			id,
			actor.role === "ADMIN"
				? data
				: {
						...data,
						status: "PENDING",
						reviewerId: null,
						moderationNote: null,
						rejectionReason: null,
					},
		);
		if (actor.role !== "ADMIN") this.notifyModerators(updated, actor);
		return this.toOpportunityForActor(updated, actor);
	}

	async listForModeration(
		filters: ModerationOpportunitiesQuery,
		actor: OpportunityActor,
	) {
		this.assertAdmin(actor);
		const result = await this.repository.listForModeration(filters);
		return {
			...result,
			opportunities: result.opportunities.map((opportunity) =>
				this.toOpportunity(opportunity),
			),
		};
	}

	async approve(id: string, actor: OpportunityActor, note?: string) {
		return this.moderate(id, actor, "PUBLISHED", note ?? null);
	}

	async reject(id: string, actor: OpportunityActor, reason: string) {
		return this.moderate(id, actor, "REJECTED", reason);
	}

	private async moderate(
		id: string,
		actor: OpportunityActor,
		status: "PUBLISHED" | "REJECTED",
		note: string | null,
	) {
		this.assertAdmin(actor);
		const decision = await this.repository.findForDecision(id);
		if (!decision) throw new OpportunityNotFoundError();
		const result = await this.repository.moderate(id, actor.id, status, note);
		if (result.count !== 1) throw new OpportunityStateConflictError();
		void enqueueEmail(
			"opportunity-decision",
			{
				to: decision.author.email,
				firstName: decision.author.firstName,
				title: decision.roleTitle,
				status,
				reason: note,
			},
			`opportunity-decision-${id}-${status}`,
		).catch(() => undefined);
		return { opportunityId: id, status };
	}

	private assertPublisher(actor: OpportunityActor) {
		if (actor.role === "ADMIN" || actor.role === "VISITOR") return;
		if (actor.role === "ALUMNI" && actor.verificationStatus === "VERIFIED") {
			return;
		}
		throw new OpportunityForbiddenError(
			"Only visitors and verified alumni can publish opportunities",
			"OPPORTUNITY_PUBLISHER_REQUIRED",
		);
	}

	private assertReader(actor: OpportunityActor) {
		if (actor.role === "STUDENT") return;
		if (actor.role === "ALUMNI" && actor.verificationStatus === "VERIFIED") {
			return;
		}
		throw new OpportunityForbiddenError(
			"Only students and verified alumni can browse opportunities",
			"OPPORTUNITY_READER_REQUIRED",
		);
	}

	private assertAdmin(actor: OpportunityActor) {
		if (actor.role !== "ADMIN") throw new OpportunityForbiddenError();
	}

	private toOpportunity(opportunity: OpportunityView) {
		return {
			...opportunity,
			deadline: opportunity.deadline.toISOString().slice(0, 10),
		};
	}

	private toOpportunityForActor(
		opportunity: OpportunityView,
		actor: OpportunityActor,
	) {
		if (actor.role !== "VISITOR") return this.toOpportunity(opportunity);
		const {
			authorId: _authorId,
			reviewerId: _reviewerId,
			author: _author,
			reviewer: _reviewer,
			...safe
		} = opportunity;
		return { ...safe, deadline: safe.deadline.toISOString().slice(0, 10) };
	}

	private notifyModerators(
		opportunity: OpportunityView,
		actor: OpportunityActor,
	) {
		if (!env.EVENTS_NOTIFICATION_EMAIL || !actor.email) return;
		void enqueueEmail(
			"content-notification",
			{
				to: env.EVENTS_NOTIFICATION_EMAIL,
				contentType: "Opportunity",
				title: opportunity.roleTitle,
				authorName:
					`${actor.firstName ?? "Publisher"} ${actor.lastName ?? ""}`.trim(),
				authorEmail: actor.email,
				status: opportunity.status === "PUBLISHED" ? "PUBLISHED" : "PENDING",
			},
			`opportunity-submitted-${opportunity.id}-${Date.now()}`,
		).catch(() => undefined);
	}
}
