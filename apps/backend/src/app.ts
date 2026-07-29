import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyServerOptions } from "fastify";
import {
	jsonSchemaTransform,
	jsonSchemaTransformObject,
	serializerCompiler,
	validatorCompiler,
} from "fastify-type-provider-zod";
import { z } from "zod/v4";
import { env } from "./config/env.config";
import { loggerOptions } from "./config/logger.config";
import { registerModules } from "./modules";
import errorPlugin from "./plugins/error.plugin";
import prismaPlugin from "./plugins/prisma.plugin";
import responsePlugin from "./plugins/response.plugin";
import storagePlugin from "./plugins/storage.plugin";
import { closeEmailQueue } from "./queues/email.queue";

export const buildApp = async (options: FastifyServerOptions = {}) => {
	const app = Fastify({
		logger: loggerOptions,
		...options,
	});

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	await app.register(errorPlugin);
	await app.register(responsePlugin);
	await app.register(helmet);
	await app.register(cors, {
		credentials: true,
		methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		origin: true,
	});
	await app.register(cookie, {
		secret: env.JWT_SECRET,
	});
	await app.register(jwt, {
		secret: env.JWT_SECRET,
		sign: {
			expiresIn: env.JWT_EXPIRES_IN,
		},
	});
	await app.register(storagePlugin);
	await app.register(prismaPlugin);
	await app.register(swagger, {
		openapi: {
			info: {
				title: "Nalum API",
				description: "Backend API for auth, profiles, and platform features.",
				version: "1.0.0",
			},
			components: {
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						bearerFormat: "JWT",
					},
				},
			},
		},
		transform: jsonSchemaTransform,
		transformObject: jsonSchemaTransformObject,
	});
	await app.register(swaggerUi, {
		routePrefix: "/docs",
	});

	app.get(
		"/api/health",
		{
			schema: {
				summary: "Health check",
				description: "Health check endpoint to verify that the API is running.",
				tags: ["Health"],
				response: {
					200: z.object({
						status: z.string(),
					}),
				},
			},
		},
		async () => ({ status: "OK" }),
	);

	await app.register(registerModules);

	app.addHook("onClose", async () => {
		await closeEmailQueue();
	});

	return app;
};

export default buildApp;
