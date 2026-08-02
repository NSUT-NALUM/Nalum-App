import fastifyMultipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { env } from "../config/env.config";
import { StorageService } from "../modules/storage/storage.service";

declare module "fastify" {
	interface FastifyInstance {
		storage: StorageService;
	}
}

const storagePlugin: FastifyPluginAsync = async (fastify) => {
	await fastify.register(fastifyMultipart, {
		limits: {
			fileSize: 10 * 1024 * 1024,
			files: 10,
		},
	});

	const storage = new StorageService(fastify.log);

	if (env.NODE_ENV !== "test") {
		await storage.ensureBucket();
	}

	fastify.decorate("storage", storage);
};

export default fp(storagePlugin);
