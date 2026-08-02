import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requirePlatformAccess } from "../../middlewares/auth.middleware";
import { PostController } from "./post.controller";
import { PostRepository } from "./post.repository";
import * as schema from "./post.schema";
import { PostService } from "./post.service";

const postRoutes: FastifyPluginAsync = async (fastify) => {
	const controller = new PostController(
		new PostService(new PostRepository(fastify.prisma)),
	);
	const app = fastify.withTypeProvider<ZodTypeProvider>();
	const secured = {
		preHandler: requirePlatformAccess,
		schema: {
			tags: ["Posts"],
			security: [{ bearerAuth: [] }],
			response: { 200: schema.postResponseSchema },
		},
	};
	const multipart = {
		...secured,
		validatorCompiler: () => () => true,
		schema: {
			...secured.schema,
			consumes: ["multipart/form-data"],
			body: schema.postMultipartSchema,
		},
	};

	app.post(
		"/",
		{
			...multipart,
			schema: {
				...multipart.schema,
				response: { 201: schema.postResponseSchema },
			},
		},
		controller.create,
	);
	app.get(
		"/",
		{
			...secured,
			schema: { ...secured.schema, querystring: schema.pageQuerySchema },
		},
		controller.list,
	);
	app.get(
		"/mine",
		{
			...secured,
			schema: { ...secured.schema, querystring: schema.pageQuerySchema },
		},
		controller.mine,
	);
	app.get(
		"/:postId",
		{
			...secured,
			schema: { ...secured.schema, params: schema.postIdParamsSchema },
		},
		controller.get,
	);
	app.patch(
		"/:postId",
		{
			...multipart,
			schema: { ...multipart.schema, params: schema.postIdParamsSchema },
		},
		controller.update,
	);
	app.get(
		"/:postId/comments",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.postIdParamsSchema,
				querystring: schema.pageQuerySchema,
			},
		},
		controller.listComments,
	);
	app.post(
		"/:postId/comments",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.postIdParamsSchema,
				body: schema.commentSchema,
				response: { 201: schema.postResponseSchema },
			},
		},
		controller.createComment,
	);
	app.put(
		"/:postId/vote",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.postIdParamsSchema,
				body: schema.voteSchema,
			},
		},
		controller.setPostVote,
	);
	app.delete(
		"/:postId/vote",
		{
			...secured,
			schema: { ...secured.schema, params: schema.postIdParamsSchema },
		},
		controller.removePostVote,
	);
	app.post(
		"/:postId/reports",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.postIdParamsSchema,
				body: schema.reportSchema,
				response: { 201: schema.postResponseSchema },
			},
		},
		controller.reportPost,
	);
	app.patch(
		"/comments/:commentId",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.commentIdParamsSchema,
				body: schema.commentUpdateSchema,
			},
		},
		controller.updateComment,
	);
	app.put(
		"/comments/:commentId/vote",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.commentIdParamsSchema,
				body: schema.voteSchema,
			},
		},
		controller.setCommentVote,
	);
	app.delete(
		"/comments/:commentId/vote",
		{
			...secured,
			schema: { ...secured.schema, params: schema.commentIdParamsSchema },
		},
		controller.removeCommentVote,
	);
	app.post(
		"/comments/:commentId/reports",
		{
			...secured,
			schema: {
				...secured.schema,
				params: schema.commentIdParamsSchema,
				body: schema.reportSchema,
				response: { 201: schema.postResponseSchema },
			},
		},
		controller.reportComment,
	);
};

export default postRoutes;
