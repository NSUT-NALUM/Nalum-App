import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
	authenticateUser,
	requirePlatformAccess,
} from "../../middlewares/auth.middleware";
import { UserController } from "./user.controller";
import { UserRepository } from "./user.repository";
import * as schema from "./user.schema";
import { UserService } from "./user.service";

const userRoutes: FastifyPluginAsync = async (fastify) => {
	const repository = new UserRepository(fastify.prisma);
	const service = new UserService(repository);
	const controller = new UserController(service);
	const app = fastify.withTypeProvider<ZodTypeProvider>();

	app.get(
		"/me",
		{
			preHandler: authenticateUser,
			schema: {
				summary: "Get current user details",
				description:
					"Returns the current user with profile, social media, and experiences.",
				tags: ["Users"],
				security: [{ bearerAuth: [] }],
				response: {
					200: schema.userDetailsResponseSchema,
				},
			},
		},
		controller.getCurrentUser,
	);

	app.get(
		"/search",
		{
			preHandler: requirePlatformAccess,
			schema: {
				summary: "Search users",
				description: "Searches users by text query and profile filters.",
				tags: ["Users"],
				security: [{ bearerAuth: [] }],
				querystring: schema.searchUsersQuerySchema,
				response: {
					200: schema.searchUsersResponseSchema,
				},
			},
		},
		controller.searchUsers,
	);
};

export default userRoutes;
