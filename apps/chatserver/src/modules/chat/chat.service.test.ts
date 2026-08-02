import { expect, test } from "bun:test";
import { ChatService } from "./chat.service";

test("requires an accepted connection before creating a direct conversation", async () => {
	const service = new ChatService({
		findUserById: async () => ({ id: "recipient" }),
		findConnectionRequest: async () => ({ status: "PENDING" }),
	} as never);

	await expect(
		service.createDirectConversation("sender", "recipient"),
	).rejects.toMatchObject({
		code: "CHAT_CONNECTION_REQUIRED",
	});
});

test("enforces the declined-request cooldown", async () => {
	const service = new ChatService({
		findUserById: async () => ({ id: "recipient" }),
		findConnectionRequest: async () => ({
			status: "DECLINED",
			updatedAt: new Date(),
		}),
	} as never);

	await expect(
		service.createConnectionRequest("sender", "recipient", "Hello"),
	).rejects.toMatchObject({
		code: "CHAT_CONNECTION_COOLDOWN",
	});
});

test("keeps the edit window on the shared message path", async () => {
	const service = new ChatService({
		findMessage: async () => ({
			id: "message",
			senderId: "sender",
			type: "USER",
			deletedAt: null,
			createdAt: new Date(Date.now() - 16 * 60_000),
		}),
	} as never);

	await expect(
		service.editMessage("sender", {
			messageId: "message",
			text: "Updated",
			mentionUserIds: [],
			mentionsEveryone: false,
		}),
	).rejects.toMatchObject({ code: "CHAT_EDIT_WINDOW" });
});

test("creates groups with pending invitations instead of active members", async () => {
	let created: { name: string; ownerId: string; inviteeIds: string[] } | null =
		null;
	const service = new ChatService({
		findUsersByIds: async () => [{ id: "invitee" }],
		createGroup: async (
			name: string,
			ownerId: string,
			inviteeIds: string[],
		) => {
			created = { name, ownerId, inviteeIds };
			return {
				id: "group",
				groupInvitations: [{ id: "invitation" }],
			};
		},
	} as never);

	const result = await service.createGroup("owner", "Study group", ["invitee"]);

	expect(
		created as unknown as {
			name: string;
			ownerId: string;
			inviteeIds: string[];
		},
	).toEqual({
		name: "Study group",
		ownerId: "owner",
		inviteeIds: ["invitee"],
	});
	expect(result.groupInvitations).toHaveLength(1);
});
