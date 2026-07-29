import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "../../config/env.config";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { RedisAccessRevocationPublisher } from "../access/access-revocation.service";
import { EmailService } from "../email";
import { AdminController } from "./admin.controller";
import { AdminRepository } from "./admin.repository";
import * as schema from "./admin.schema";
import { AdminService } from "./admin.service";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
	const repository = new AdminRepository(fastify.prisma);
	const revocations = new RedisAccessRevocationPublisher(env.REDIS_URL);
	const service = new AdminService(repository, new EmailService(), revocations);
	const controller = new AdminController(service);
	const app = fastify.withTypeProvider<ZodTypeProvider>();
	const secured = {
		preHandler: requireAdmin,
		schema: {
			tags: ["Admin"],
			security: [{ bearerAuth: [] }],
			response: { 200: schema.adminResponseSchema },
		},
	};

	app.get("/overview", secured, controller.overview);
	app.get(
		"/alumni",
		{
			...secured,
			schema: {
				...secured.schema,
				querystring: schema.alumniReviewQuerySchema,
			},
		},
		controller.listAlumni,
	);
	app.get(
		"/alumni/:userId",
		{
			...secured,
			schema: { ...secured.schema, params: schema.userIdParamsSchema },
		},
		controller.getApplication,
	);
	app.post(
		"/alumni/:userId/approve",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.userIdParamsSchema,
				body: schema.approveSchema,
			},
		},
		controller.approve,
	);
	app.post(
		"/alumni/:userId/reject",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.userIdParamsSchema,
				body: schema.reasonSchema,
			},
		},
		controller.reject,
	);
	app.post(
		"/alumni/:userId/reopen",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.userIdParamsSchema,
				body: schema.reasonSchema,
			},
		},
		controller.reopen,
	);
	app.get(
		"/users",
		{
			...secured,
			schema: { ...secured.schema, querystring: schema.adminUsersQuerySchema },
		},
		controller.listUsers,
	);
	app.get(
		"/users/:userId",
		{
			...secured,
			schema: { ...secured.schema, params: schema.userIdParamsSchema },
		},
		controller.getUser,
	);
	app.post(
		"/users/:userId/ban",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.userIdParamsSchema,
				body: schema.banSchema,
				response: { 201: schema.adminResponseSchema },
			},
		},
		controller.ban,
	);
	app.post(
		"/users/:userId/unban",
		{
			...secured,
			schema: { ...secured.schema, params: schema.userIdParamsSchema },
		},
		controller.unban,
	);

	fastify.addHook("onReady", async () => {
		void service.reconcileNotifications().catch((error) => {
			fastify.log.warn({ err: error }, "Unable to reconcile review emails");
		});
	});
	const reconciliationInterval = setInterval(
		() => {
			void service.reconcileNotifications().catch((error) => {
				fastify.log.warn({ err: error }, "Unable to reconcile review emails");
			});
		},
		5 * 60 * 1000,
	);
	reconciliationInterval.unref();
	fastify.addHook("onClose", async () => {
		clearInterval(reconciliationInterval);
		await revocations.close();
	});
};

export default adminRoutes;
