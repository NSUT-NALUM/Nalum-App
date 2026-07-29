import type { FastifyReply, FastifyRequest } from "fastify";
import { getCurrentUser } from "../../middlewares/auth.middleware";
import type {
	AdminUsersQuery,
	AlumniReviewQuery,
	ApproveBody,
	BanBody,
	ReasonBody,
	UserIdParams,
} from "./admin.schema";
import type { AdminService } from "./admin.service";

export class AdminController {
	constructor(private readonly service: AdminService) {}

	overview = async (_request: FastifyRequest, reply: FastifyReply) =>
		reply.success(await this.service.getOverview());

	listAlumni = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.listAlumni(request.query as AlumniReviewQuery),
		);

	getApplication = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.getApplication(
				(request.params as UserIdParams).userId,
			),
		);

	approve = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.approve(
				(request.params as UserIdParams).userId,
				getCurrentUser(request).id,
				(request.body as ApproveBody).note,
			),
			"Alumni application approved",
		);

	reject = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.reject(
				(request.params as UserIdParams).userId,
				getCurrentUser(request).id,
				(request.body as ReasonBody).reason,
			),
			"Alumni application rejected",
		);

	reopen = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.reopen(
				(request.params as UserIdParams).userId,
				getCurrentUser(request).id,
				(request.body as ReasonBody).reason,
			),
			"Alumni application reopened",
		);

	listUsers = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.listUsers(request.query as AdminUsersQuery),
		);

	getUser = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.getUser((request.params as UserIdParams).userId),
		);

	ban = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.ban(
				(request.params as UserIdParams).userId,
				getCurrentUser(request).id,
				request.body as BanBody,
			),
			"User banned",
			201,
		);

	unban = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.service.unban(
				(request.params as UserIdParams).userId,
				getCurrentUser(request).id,
			),
			"User unbanned",
		);
}
