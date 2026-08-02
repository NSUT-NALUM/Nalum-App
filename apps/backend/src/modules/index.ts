import type { FastifyPluginAsync } from "fastify";
import adminRoutes from "./admin/admin.routes";
import authRoutes from "./auth/auth.routes";
import chatAttachmentRoutes from "./chat-attachment/chat-attachment.routes";
import eventsRoutes from "./events/events.routes";
import profileRoutes from "./profile/profile.routes";
import storageRoutes from "./storage/storage.routes";
import userRoutes from "./user/user.routes";

export const registerModules: FastifyPluginAsync = async (fastify) => {
	await fastify.register(authRoutes, { prefix: "/api/auth" });
	await fastify.register(chatAttachmentRoutes, { prefix: "/api/chat" });
	await fastify.register(adminRoutes, { prefix: "/api/admin" });
	await fastify.register(eventsRoutes, { prefix: "/api/events" });
	await fastify.register(profileRoutes, { prefix: "/api/profile" });
	await fastify.register(storageRoutes, { prefix: "/api/storage" });
	await fastify.register(userRoutes, { prefix: "/api/users" });
};
