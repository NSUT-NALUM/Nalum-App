import type { FastifyReply, FastifyRequest } from "fastify";
import { getCurrentUser } from "../../middlewares/auth.middleware";
import type { SearchUsersQuery } from "./user.schema";
import type { UserService } from "./user.service";

export class UserController {
	constructor(private readonly userService: UserService) {}

	getCurrentUser = async (request: FastifyRequest, reply: FastifyReply) => {
		const currentUser = getCurrentUser(request);
		const user = await this.userService.getUserDetails(currentUser.id);
		if (currentUser.role === "VISITOR") {
			return reply.success(
				{
					...user,
					profile: null,
					socialMedia: null,
					experiences: [],
					latestReviewReason: null,
				},
				"User profile retrieved successfully",
			);
		}
		return reply.success(user, "User profile retrieved successfully");
	};

	searchUsers = async (request: FastifyRequest, reply: FastifyReply) => {
		const result = await this.userService.searchUsers(
			request.query as SearchUsersQuery,
		);
		return reply.success(result, "Users retrieved successfully");
	};
}
