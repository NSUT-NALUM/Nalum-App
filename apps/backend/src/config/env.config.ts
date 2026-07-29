/**
 * env
 * This file is responsible for loading and validating environment variables using the zod library. It ensures that all required environment variables are present and correctly formatted before the application starts. If any required variable is missing or invalid, it will throw an error and prevent the application from running.
 */

import dotenv from "dotenv";
import z from "zod/v4";

dotenv.config();

// Define and validate all required environment variables.

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	PORT: z.coerce.number().default(5000),
	DATABASE_URL: z.url(),
	REDIS_URL: z.url().default("redis://localhost:6379"),
	JWT_SECRET: z.string().min(32),
	JWT_EXPIRES_IN: z.string().default("1h"),
	GOOGLE_CLIENT_ID: z.string(),
	GOOGLE_CLIENT_SECRET: z.string(),
	GOOGLE_CALLBACK_URL: z.url(),
	GOOGLE_REDIRECT_URL: z.url(),
	WEB_APP_URL: z.url(),
	BREVO_SMTP_HOST: z.string().optional(),
	BREVO_SMTP_PORT: z.coerce.number().optional(),
	BREVO_SMTP_USER: z.string().optional(),
	BREVO_SMTP_PASS: z.string().optional(),
	BREVO_FROM_EMAIL: z.email().optional(),
	BREVO_FROM_NAME: z.string().default("NSUT ALUMNI ASSOCIATION"),
	EMAIL_QUEUE_NAME: z.string(),
	S3_ENDPOINT: z.url().default("http://localhost:9000"),
	S3_REGION: z.string().default("us-east-1"),
	S3_ACCESS_KEY_ID: z.string().optional(),
	S3_SECRET_ACCESS_KEY: z.string().optional(),
	S3_BUCKET: z.string().min(1).default("nalum-uploads"),
	S3_FORCE_PATH_STYLE: z
		.preprocess((value) => {
			if (value === undefined || value === "") return true;
			if (value === "true") return true;
			if (value === "false") return false;
			return value;
		}, z.boolean())
		.default(true),
});

// Validate once during application startup.

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
	console.error(
		"Invalid environment variables:",
		z.treeifyError(parseResult.error),
	);
	process.exit(1);
}

if (
	parseResult.data.NODE_ENV !== "test" &&
	(!parseResult.data.S3_ACCESS_KEY_ID || !parseResult.data.S3_SECRET_ACCESS_KEY)
) {
	console.error("Invalid environment variables: S3 credentials are required");
	process.exit(1);
}

export const env = parseResult.data;

export type env = z.infer<typeof envSchema>;
