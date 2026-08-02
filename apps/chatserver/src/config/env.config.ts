import { z } from "zod/v4";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	CHAT_PORT: z.coerce.number().default(3001),
	DATABASE_URL: z.url(),
	REDIS_URL: z.url().default("redis://localhost:6379"),
	CHAT_CORS_ORIGIN: z.string().default("http://localhost:8081"),
	JWT_SECRET: z.string().min(32),
	JWT_EXPIRES_IN: z.string().default("15m"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error(
		"Invalid chatserver environment variables:",
		z.treeifyError(parsedEnv.error),
	);
	process.exit(1);
}

export const env = parsedEnv.data;
