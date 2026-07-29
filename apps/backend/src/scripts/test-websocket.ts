import { createPrismaClient } from "@nalum/database/client";
import jwt from "jsonwebtoken";

const JWT_SECRET = "UrXSliKhJXkJGVNQXdnn77iiLnrq5Ic006hduf4rOeO";
const DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/nalum";

async function main() {
	// 1. Initialize Prisma client
	const prisma = createPrismaClient(DATABASE_URL);

	try {
		console.log("Connecting to database...");
		await prisma.$connect();

		// 2. Find or create a test user
		const email = "testwebsocket@nsut.ac.in";
		let user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			console.log("Creating test user...");
			user = await prisma.user.create({
				data: {
					email,
					firstName: "Test",
					lastName: "Websocket",
					role: "STUDENT",
					emailVerified: true,
				},
			});
		}
		console.log("User ID:", user.id);

		// 3. Generate a JWT token
		const payload = {
			sub: user.id,
			email: user.email,
			role: user.role,
			tokenType: "access",
		};
		const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
		console.log("Generated Access JWT:", token);

		// 4. Connect to chatserver WebSocket
		const wsUrl = "ws://localhost:3001/ws";
		console.log(`Connecting to WebSocket: ${wsUrl}...`);
		const ws = new WebSocket(wsUrl, ["nalum.chat.v1", token]);

		ws.onopen = () => {
			console.log("WebSocket connection opened successfully!");
		};

		ws.onmessage = (event) => {
			console.log("Received message from server:", event.data);
			ws.close();
			prisma.$disconnect();
			process.exit(0);
		};

		ws.onerror = (error) => {
			console.error("WebSocket error:", error);
			prisma.$disconnect();
			process.exit(1);
		};

		ws.onclose = (event) => {
			console.log("WebSocket connection closed:", event.code, event.reason);
			prisma.$disconnect();
			process.exit(0);
		};

		// Set a timeout to prevent hanging if no response
		setTimeout(() => {
			console.error("Timeout: did not receive socket:ack within 10 seconds");
			ws.close();
			prisma.$disconnect();
			process.exit(1);
		}, 10000);

	} catch (error) {
		console.error("Error running test:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
}

main();
