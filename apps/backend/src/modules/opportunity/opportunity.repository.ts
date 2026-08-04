import type {
	OpportunityStatus,
	Prisma,
	PrismaClient,
} from "../../database/prisma/generated/client";
import type {
	ModerationOpportunitiesQuery,
	OpportunityPageQuery,
	OpportunityUpdate,
} from "./opportunity.schema";
import type { OpportunityCreateInput } from "./opportunity.types";

const personSelect = {
	id: true,
	firstName: true,
	lastName: true,
} satisfies Prisma.UserSelect;

const opportunityInclude = {
	author: { select: personSelect },
	reviewer: { select: personSelect },
} satisfies Prisma.OpportunityInclude;

export class OpportunityRepository {
	constructor(private readonly prisma: PrismaClient) {}

	create(input: OpportunityCreateInput) {
		return this.prisma.opportunity.create({
			data: input,
			include: opportunityInclude,
		});
	}

	findById(id: string) {
		return this.prisma.opportunity.findUnique({
			where: { id },
			include: opportunityInclude,
		});
	}

	findForDecision(id: string) {
		return this.prisma.opportunity.findUnique({
			where: { id },
			select: {
				id: true,
				roleTitle: true,
				status: true,
				author: { select: { firstName: true, email: true } },
			},
		});
	}

	async listPublished(filters: OpportunityPageQuery) {
		const where: Prisma.OpportunityWhereInput = {
			status: "PUBLISHED",
			deadline: { gte: new Date() },
		};
		const [opportunities, total] = await this.prisma.$transaction([
			this.prisma.opportunity.findMany({
				where,
				include: opportunityInclude,
				orderBy: [{ deadline: "asc" }, { id: "asc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.opportunity.count({ where }),
		]);
		return {
			opportunities,
			total,
			limit: filters.limit,
			offset: filters.offset,
		};
	}

	async listMine(authorId: string, filters: OpportunityPageQuery) {
		const where = { authorId };
		const [opportunities, total] = await this.prisma.$transaction([
			this.prisma.opportunity.findMany({
				where,
				include: opportunityInclude,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.opportunity.count({ where }),
		]);
		return {
			opportunities,
			total,
			limit: filters.limit,
			offset: filters.offset,
		};
	}

	update(
		id: string,
		data: OpportunityUpdate & {
			status?: OpportunityStatus;
			reviewerId?: string | null;
			moderationNote?: string | null;
			rejectionReason?: string | null;
		},
	) {
		return this.prisma.opportunity.update({
			where: { id },
			data,
			include: opportunityInclude,
		});
	}

	async listForModeration(filters: ModerationOpportunitiesQuery) {
		const where: Prisma.OpportunityWhereInput = {
			status: filters.status as OpportunityStatus,
			...(filters.q
				? {
						OR: [
							{ roleTitle: { contains: filters.q, mode: "insensitive" } },
							{ organization: { contains: filters.q, mode: "insensitive" } },
							{ description: { contains: filters.q, mode: "insensitive" } },
						],
					}
				: {}),
		};
		const [opportunities, total] = await this.prisma.$transaction([
			this.prisma.opportunity.findMany({
				where,
				include: opportunityInclude,
				orderBy: [{ createdAt: "asc" }, { id: "asc" }],
				take: filters.limit,
				skip: filters.offset,
			}),
			this.prisma.opportunity.count({ where }),
		]);
		return {
			opportunities,
			total,
			limit: filters.limit,
			offset: filters.offset,
		};
	}

	moderate(
		id: string,
		reviewerId: string,
		status: "PUBLISHED" | "REJECTED",
		note: string | null,
	) {
		return this.prisma.opportunity.updateMany({
			where: { id, status: "PENDING" },
			data:
				status === "PUBLISHED"
					? { status, reviewerId, moderationNote: note, rejectionReason: null }
					: { status, reviewerId, moderationNote: null, rejectionReason: note },
		});
	}
}
