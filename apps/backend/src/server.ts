/**
 * Server
 * This is the entry point for the backend server. It initializes the Fastify server. It handles graceful shutdowns, and manages the server lifecycle. It is responsible for starting the server and listening for incoming requests.
 * Handle SIGINT
 * Handle SIGTERM
 *
 * Usage:
 *  bun run start
 *
 * Note: Ensure that you have made the necessary changes in app.ts
 */
import { buildApp } from "./app";
import { env } from "./config/env.config";

const { PORT } = env;
const bootstrap = async () => {
	const app = await buildApp();

	try {
		await app.listen({ port: PORT, host: "0.0.0.0" });
		app.log.info(`Server is running on port ${PORT}`);
	} catch (err) {
		app.log.fatal(err);
		process.exit(1);
	}

	const close = async () => {
		await app.close();
		process.exit(0);
	};

	process.once("SIGINT", close);
	process.once("SIGTERM", close);
};

bootstrap();
