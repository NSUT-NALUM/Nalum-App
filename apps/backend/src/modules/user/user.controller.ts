import type { FastifyReply, FastifyRequest } from "fastify";
import { getCurrentUser } from "../../middlewares/auth.middleware";
import type { SearchUsersQuery } from "./user.schema";
import type { UserService } from "./user.service";

export class UserController {
	constructor(private readonly userService: UserService) {}

	getCurrentUser = async (request: FastifyRequest, reply: FastifyReply) => {
		const user = await this.userService.getUserDetails(
			getCurrentUser(request).id,
		);
		return reply.success(user, "User profile retrieved successfully");
	};

	searchUsers = async (request: FastifyRequest, reply: FastifyReply) => {
		const result = await this.userService.searchUsers(
			request.query as SearchUsersQuery,
		);
		return reply.success(result, "Users retrieved successfully");
	};
}
