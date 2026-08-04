import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "../../config/env.config";
import { requireAdmin } from "../../middlewares/auth.middleware";
import { RedisAccessRevocationPublisher } from "../access/access-revocation.service";
import { EmailService } from "../email";
import { EventsController } from "../events/events.controller";
import { EventsRepository } from "../events/events.repository";
import * as eventsSchema from "../events/events.schema";
import { EventsService } from "../events/events.service";
import { OpportunityController } from "../opportunity/opportunity.controller";
import { OpportunityRepository } from "../opportunity/opportunity.repository";
import * as opportunitySchema from "../opportunity/opportunity.schema";
import { OpportunityService } from "../opportunity/opportunity.service";
import { PostController } from "../post/post.controller";
import { PostRepository } from "../post/post.repository";
import * as postSchema from "../post/post.schema";
import { PostService } from "../post/post.service";
import { AdminController } from "./admin.controller";
import { AdminRepository } from "./admin.repository";
import * as schema from "./admin.schema";
import { AdminService } from "./admin.service";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
	const repository = new AdminRepository(fastify.prisma);
	const revocations = new RedisAccessRevocationPublisher(env.REDIS_URL);
	const service = new AdminService(repository, new EmailService(), revocations);
	const controller = new AdminController(service);
	const eventsController = new EventsController(
		new EventsService(new EventsRepository(fastify.prisma)),
	);
	const postController = new PostController(
		new PostService(new PostRepository(fastify.prisma)),
	);
	const opportunityController = new OpportunityController(
		new OpportunityService(new OpportunityRepository(fastify.prisma)),
	);
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
	app.get(
		"/events",
		{
			...secured,
			schema: {
				...secured.schema,
				querystring: eventsSchema.moderationEventsQuerySchema,
			},
		},
		eventsController.moderationList,
	);
	app.post(
		"/events/:eventId/approve",
		{
			...secured,
			schema: {
				...secured.schema,
				params: eventsSchema.eventIdParamsSchema,
				body: eventsSchema.moderationNoteSchema,
			},
		},
		eventsController.approve,
	);
	app.post(
		"/events/:eventId/reject",
		{
			...secured,
			schema: {
				...secured.schema,
				params: eventsSchema.eventIdParamsSchema,
				body: eventsSchema.rejectionSchema,
			},
		},
		eventsController.reject,
	);
	app.get(
		"/posts",
		{
			...secured,
			schema: {
				...secured.schema,
				querystring: postSchema.moderationPostsQuerySchema,
			},
		},
		postController.moderationList,
	);
	app.post(
		"/posts/:postId/approve",
		{
			...secured,
			schema: {
				...secured.schema,
				params: postSchema.postIdParamsSchema,
				body: postSchema.moderationNoteSchema,
			},
		},
		postController.approve,
	);
	app.post(
		"/posts/:postId/reject",
		{
			...secured,
			schema: {
				...secured.schema,
				params: postSchema.postIdParamsSchema,
				body: postSchema.rejectionSchema,
			},
		},
		postController.reject,
	);
	app.get(
		"/opportunities",
		{
			...secured,
			schema: {
				...secured.schema,
				querystring: opportunitySchema.moderationOpportunitiesQuerySchema,
			},
		},
		opportunityController.moderationList,
	);
	app.post(
		"/opportunities/:opportunityId/approve",
		{
			...secured,
			schema: {
				...secured.schema,
				params: opportunitySchema.opportunityIdParamsSchema,
				body: opportunitySchema.moderationNoteSchema,
			},
		},
		opportunityController.approve,
	);
	app.post(
		"/opportunities/:opportunityId/reject",
		{
			...secured,
			schema: {
				...secured.schema,
				params: opportunitySchema.opportunityIdParamsSchema,
				body: opportunitySchema.rejectionSchema,
			},
		},
		opportunityController.reject,
	);
	app.get(
		"/posts/reports",
		{
			...secured,
			schema: { ...secured.schema, querystring: postSchema.reportsQuerySchema },
		},
		postController.listReports,
	);
	app.post(
		"/posts/reports/:reportId/dismiss",
		{
			...secured,
			schema: { ...secured.schema, params: postSchema.reportIdParamsSchema },
		},
		postController.dismissReport,
	);
	app.post(
		"/posts/reports/:reportId/remove-content",
		{
			...secured,
			schema: { ...secured.schema, params: postSchema.reportIdParamsSchema },
		},
		postController.removeReportedContent,
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
