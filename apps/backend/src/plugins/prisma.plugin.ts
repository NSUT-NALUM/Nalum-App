/**
 * prisma.plugin.ts
 *
 * Responsibilities:
 * Create Prisma client instance
 *  Register Prisma client as a Fastify plugin
 */

import fastifyPrisma from "@zrosenbauer/fastify-prisma";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import {
	createPrismaClient,
	type PrismaClient,
} from "@nalum/database/client";
import { env } from "../config/env.config";

// Module augmentation to strictly type the prisma decorator on the Fastify instance
declare module "fastify" {
	interface FastifyInstance {
		prisma: PrismaClient;
	}
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
	// Register the fastify-prisma plugin with your custom generated PrismaClient
	await fastify.register(fastifyPrisma, {
		client: createPrismaClient(env.DATABASE_URL),
	});
};

export default fp(prismaPlugin);
