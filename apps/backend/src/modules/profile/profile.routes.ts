import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "../../config/env.config";
import { requireApplicationAccess } from "../../middlewares/auth.middleware";
import { RedisAccessRevocationPublisher } from "../access/access-revocation.service";
import { ProfileController } from "./profile.controller";
import { ProfileRepository } from "./profile.repository";
import * as schema from "./profile.schema";
import { ProfileService } from "./profile.service";

const profileRoutes: FastifyPluginAsync = async (fastify) => {
	const repository = new ProfileRepository(fastify.prisma);
	const revocations = new RedisAccessRevocationPublisher(env.REDIS_URL);
	const service = new ProfileService(repository, revocations);
	const controller = new ProfileController(service);
	const app = fastify.withTypeProvider<ZodTypeProvider>();

	app.post(
		"/",
		{
			preHandler: requireApplicationAccess,
			schema: {
				summary: "Create user profile",
				description:
					"Creates the basic user profile containing batch, branch, and campus details.",
				tags: ["Profile"],
				security: [{ bearerAuth: [] }],
				body: schema.createProfileSchemaRequest,
				response: {
					201: schema.profileResponseSchema,
				},
			},
		},
		controller.createProfile,
	);

	app.put(
		"/",
		{
			preHandler: requireApplicationAccess,
			validatorCompiler: () => () => true, // Bypass json body validator to handle multipart manually
			schema: {
				summary: "Edit user profile",
				description:
					"Updates user profile. Accepts multipart/form-data. File upload is supported via 'profilePicture' field.",
				tags: ["Profile"],
				security: [{ bearerAuth: [] }],
				consumes: ["multipart/form-data"],
				body: schema.editProfileMultipartSchemaRequest,
				response: {
					200: schema.profileResponseSchema,
				},
			},
		},
		controller.editProfile,
	);

	app.get(
		"/me",
		{
			preHandler: requireApplicationAccess,
			schema: {
				summary: "Get current user profile",
				description: "Retrieves the profile of the currently logged-in user.",
				tags: ["Profile"],
				security: [{ bearerAuth: [] }],
				response: {
					200: schema.profileResponseSchema,
				},
			},
		},
		controller.getProfile,
	);

	fastify.addHook("onClose", () => revocations.close());
};

export default profileRoutes;
