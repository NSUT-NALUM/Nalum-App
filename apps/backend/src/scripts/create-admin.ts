import { createInterface, emitKeypressEvents } from "node:readline";
import { createPrismaClient } from "@nalum/database/client";
import argon2 from "argon2";

const readline = createInterface({
	input: process.stdin,
	output: process.stdout,
});

const question = (prompt: string) =>
	new Promise<string>((resolve) => readline.question(prompt, resolve));

const readPassword = (prompt: string) =>
	new Promise<string>((resolve, reject) => {
		if (!process.stdin.isTTY || !process.stdin.setRawMode) {
			reject(new Error("An interactive terminal is required"));
			return;
		}
		process.stdout.write(prompt);
		emitKeypressEvents(process.stdin);
		process.stdin.setRawMode(true);
		process.stdin.resume();
		let password = "";
		const onKeypress = (
			character: string,
			key: { name?: string; ctrl?: boolean },
		) => {
			if (key.ctrl && key.name === "c") {
				cleanup();
				reject(new Error("Cancelled"));
				return;
			}
			if (key.name === "return") {
				cleanup();
				process.stdout.write("\n");
				resolve(password);
				return;
			}
			if (key.name === "backspace") {
				password = password.slice(0, -1);
				return;
			}
			if (character && !key.ctrl) password += character;
		};
		const cleanup = () => {
			process.stdin.off("keypress", onKeypress);
			process.stdin.setRawMode(false);
			process.stdin.pause();
		};
		process.stdin.on("keypress", onKeypress);
	});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL is required");
}
const prisma = createPrismaClient(databaseUrl);

try {
	const email = (await question("Admin email: ")).trim().toLowerCase();
	const firstName = (await question("First name: ")).trim();
	const lastName = (await question("Last name (optional): ")).trim() || null;
	const password = await readPassword("Password (12+ characters): ");
	const confirmation = await readPassword("Confirm password: ");

	if (!email.includes("@") || !firstName) {
		throw new Error("A valid email and first name are required");
	}
	if (password.length < 12)
		throw new Error("Password must be at least 12 characters");
	if (password !== confirmation) throw new Error("Passwords do not match");

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing && existing.role !== "ADMIN") {
		const answer = (
			await question(
				`This email belongs to a ${existing.role} account. Promote it? [y/N] `,
			)
		).trim();
		if (answer.toLowerCase() !== "y") throw new Error("Cancelled");
	}

	const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
	const admin = await prisma.user.upsert({
		where: { email },
		create: {
			email,
			firstName,
			lastName,
			passwordHash,
			role: "ADMIN",
			emailVerified: true,
			emailVerifiedAt: new Date(),
		},
		update: {
			firstName,
			lastName,
			passwordHash,
			role: "ADMIN",
			emailVerified: true,
			emailVerifiedAt: new Date(),
			verificationStatus: null,
			verificationSubmittedAt: null,
		},
		select: { id: true, email: true },
	});
	process.stdout.write(`Admin ready: ${admin.email} (${admin.id})\n`);
} catch (error) {
	process.stderr.write(
		`${error instanceof Error ? error.message : "Unable to create admin"}\n`,
	);
	process.exitCode = 1;
} finally {
	readline.close();
	await prisma.$disconnect();
}
