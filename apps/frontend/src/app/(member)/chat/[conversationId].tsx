import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ImagePlus, Send, X } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import type { AlertButton } from "react-native";
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import { GroupDetails } from "@/components/group-details";
import { Screen } from "@/components/ui/nalum";
import { useChatRealtime, useChatSocket } from "@/hooks/use-chat-socket";
import {
	apiImageSource,
	type ChatAttachment,
	type ChatMessage,
	type ChatReadReceipt,
	type Conversation,
	chatApi,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const maxImageBytes = 5 * 1024 * 1024;

const memberName = (member: Conversation["participants"][number]) =>
	[member.user.firstName, member.user.lastName].filter(Boolean).join(" ");

export default function ChatThread() {
	const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
	const user = useAuthStore((state) => state.user);
	const { presence, typing } = useChatRealtime();
	const [text, setText] = useState("");
	const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
	const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
	const [editing, setEditing] = useState<ChatMessage | null>(null);
	const [mentionUserIds, setMentionUserIds] = useState<string[]>([]);
	const [mentionsEveryone, setMentionsEveryone] = useState(false);
	const [error, setError] = useState("");
	const [uploading, setUploading] = useState(false);
	const [groupOpen, setGroupOpen] = useState(false);
	const lastTypingAt = useRef(0);
	const conversations = useQuery({
		queryKey: ["chat", "conversations"],
		queryFn: chatApi.conversations,
	});
	const conversation = conversations.data?.conversations.find(
		(item) => item.id === conversationId,
	);
	const messages = useInfiniteQuery({
		queryKey: ["chat", "messages", conversationId],
		queryFn: ({ pageParam }) => chatApi.messages(conversationId, pageParam),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (page) => page.nextCursor ?? undefined,
		enabled: Boolean(conversationId),
	});
	const send = useChatSocket((event) => {
		if (event.type === "error")
			setError(
				(event.payload as { message?: string }).message ??
					"Chat action failed.",
			);
	});
	const newestFirst = useMemo(
		() => messages.data?.pages.flatMap((page) => page.messages) ?? [],
		[messages.data],
	);
	const latest = newestFirst[0];
	const readReceipts = messages.data?.pages[0]?.readReceipts ?? [];
	const me = conversation?.participants.find(
		(member) => member.userId === user?.id,
	);
	const other = conversation?.participants.find(
		(member) => member.userId !== user?.id,
	);
	const typingNames = (typing[conversationId] ?? [])
		.filter((id) => id !== user?.id)
		.map((id) => {
			const member = conversation?.participants.find(
				(item) => item.userId === id,
			);
			return member ? memberName(member) : null;
		})
		.filter((name): name is string => Boolean(name));
	const mentionMatch = text.match(/(?:^|\s)@([^\s@]*)$/);
	const mentionQuery = mentionMatch?.[1]?.toLowerCase();
	const mentionMembers =
		conversation?.type === "GROUP" && mentionQuery !== undefined
			? conversation.participants.filter(
					(member) =>
						member.userId !== user?.id &&
						memberName(member).toLowerCase().includes(mentionQuery),
				)
			: [];
	const selectedMembers = conversation?.participants.filter((member) =>
		mentionUserIds.includes(member.userId),
	);

	useFocusEffect(
		useCallback(() => {
			if (latest && conversationId)
				send("receipt:read", { conversationId, messageId: latest.id });
		}, [conversationId, latest, send]),
	);

	const chooseImage = async () => {
		if (!conversationId) return;
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			quality: 0.8,
		});
		if (result.canceled) return;
		const image = result.assets[0];
		if (image.fileSize && image.fileSize > maxImageBytes) {
			setError("Choose an image smaller than 5 MB.");
			return;
		}
		setUploading(true);
		setError("");
		try {
			const form = new FormData();
			form.append("image", {
				uri: image.uri,
				name: image.fileName ?? "chat-image.jpg",
				type: image.mimeType ?? "image/jpeg",
			} as unknown as Blob);
			setAttachment(await chatApi.uploadImage(conversationId, form));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Image upload failed.");
		} finally {
			setUploading(false);
		}
	};

	const mentionPayload = () => {
		const activeIds = (selectedMembers ?? [])
			.filter((member) => text.includes(`@${memberName(member)}`))
			.map((member) => member.userId);
		return {
			mentionUserIds: activeIds,
			mentionsEveryone: mentionsEveryone && text.includes("@everyone"),
		};
	};

	const submit = () => {
		const value = text.trim();
		if (!conversationId || uploading || (!value && !attachment)) return;
		setError("");
		const mentions = mentionPayload();
		const sent = editing
			? send("message:edit", {
					messageId: editing.id,
					text: value,
					...mentions,
				})
			: send("message:send", {
					conversationId,
					clientMessageId: crypto.randomUUID(),
					text: value,
					attachmentIds: attachment ? [attachment.id] : [],
					replyToId: replyTo?.id,
					...mentions,
				});
		if (!sent) {
			setError("Reconnecting to chat. Try again in a moment.");
			return;
		}
		setText("");
		setAttachment(null);
		setReplyTo(null);
		setEditing(null);
		setMentionUserIds([]);
		setMentionsEveryone(false);
	};

	const chooseMention = (member?: Conversation["participants"][number]) => {
		const label = member ? `@${memberName(member)}` : "@everyone";
		setText((current) => current.replace(/(^|\s)@([^\s@]*)$/, `$1${label} `));
		if (member)
			setMentionUserIds((current) =>
				current.includes(member.userId) ? current : [...current, member.userId],
			);
		else setMentionsEveryone(true);
	};

	const removeMention = (member: Conversation["participants"][number]) => {
		setMentionUserIds((current) =>
			current.filter((id) => id !== member.userId),
		);
		setText((current) =>
			current.replace(`@${memberName(member)}`, "").trimStart(),
		);
	};

	const openActions = (message: ChatMessage) => {
		if (message.type !== "USER" || message.deletedAt) return;
		const actions: AlertButton[] = [
			{ text: "Reply", onPress: () => setReplyTo(message) },
			{
				text: "React 👍",
				onPress: () =>
					send("reaction:toggle", { messageId: message.id, emoji: "👍" }),
			},
		];
		if (message.senderId === user?.id) {
			actions.push(
				{
					text: "Edit",
					onPress: () => {
						setEditing(message);
						setReplyTo(null);
						setText(message.text);
						setMentionUserIds(message.mentionUserIds);
						setMentionsEveryone(message.mentionsEveryone);
					},
				},
				{
					text: "Delete",
					style: "destructive",
					onPress: () => send("message:delete", { messageId: message.id }),
				},
			);
		}
		actions.push({ text: "Cancel", style: "cancel" });
		Alert.alert("Message", undefined, actions);
	};

	const onChangeText = (value: string) => {
		setText(value);
		if (
			conversationId &&
			value.trim() &&
			Date.now() - lastTypingAt.current > 2_000
		) {
			lastTypingAt.current = Date.now();
			send("typing:start", { conversationId });
		}
	};

	const title =
		conversation?.name ?? (other ? memberName(other) : "Conversation");
	const directPresence = other ? presence[other.userId] : undefined;

	return (
		<Screen>
			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<View className="mb-4 flex-row items-center gap-3">
					<Pressable
						accessibilityLabel="Back to chats"
						className="size-11 items-center justify-center"
						onPress={() => router.back()}
					>
						<ArrowLeft color="#6B7280" />
					</Pressable>
					<Pressable
						className="flex-1"
						disabled={conversation?.type !== "GROUP"}
						onPress={() => setGroupOpen(true)}
					>
						<Text className="text-xl font-bold text-foreground">{title}</Text>
						{typingNames.length ? (
							<Text className="text-sm text-primary">
								{typingNames.join(", ")}{" "}
								{typingNames.length === 1 ? "is" : "are"} typing…
							</Text>
						) : directPresence ? (
							<Text className="text-sm text-muted">
								{directPresence.status === "online" ? "Online" : "Offline"}
							</Text>
						) : null}
					</Pressable>
				</View>
				<ScrollView className="flex-1" contentContainerClassName="gap-2 pb-4">
					{messages.hasNextPage ? (
						<Pressable
							className="self-center rounded-full bg-card px-3 py-2"
							disabled={messages.isFetchingNextPage}
							onPress={() => void messages.fetchNextPage()}
						>
							<Text className="font-medium text-primary">
								{messages.isFetchingNextPage
									? "Loading…"
									: "Load older messages"}
							</Text>
						</Pressable>
					) : null}
					{newestFirst
						.slice()
						.reverse()
						.map((message) => {
							const mine = message.senderId === user?.id;
							const mentioned =
								message.mentionsEveryone ||
								message.mentionUserIds.includes(user?.id ?? "");
							if (message.type === "SYSTEM")
								return (
									<Text
										key={message.id}
										className="self-center text-xs text-muted"
									>
										{message.text}
									</Text>
								);
							const readers = mine
								? readReceipts.filter(
										(receipt) =>
											receipt.userId !== user?.id &&
											hasRead(receipt, message, newestFirst),
									).length
								: 0;
							return (
								<View
									key={message.id}
									className={mine ? "self-end" : "self-start"}
								>
									<Pressable
										className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.deletedAt ? "bg-card" : mine ? "bg-primary" : "bg-card"} ${mentioned && !mine ? "border border-primary" : ""}`}
										onLongPress={() => openActions(message)}
									>
										{message.replyTo ? (
											<Text
												className={`mb-1 text-xs ${mine ? "text-white/70" : "text-muted"}`}
											>
												↪ {message.replyTo.text}
											</Text>
										) : null}
										{message.deletedAt ? (
											<Text className="italic text-muted">Message deleted</Text>
										) : (
											<>
												{message.attachments.map((image) => (
													<Image
														key={image.id}
														source={apiImageSource(image.url)}
														className="mb-2 h-48 w-48 rounded-xl"
														contentFit="cover"
													/>
												))}
												<Text
													className={mine ? "text-white" : "text-foreground"}
												>
													{message.text}
												</Text>
											</>
										)}
										{message.editedAt ? (
											<Text
												className={`mt-1 text-xs ${mine ? "text-white/70" : "text-muted"}`}
											>
												Edited
											</Text>
										) : null}
										{message.reactions.length ? (
											<View className="mt-2 flex-row gap-1">
												{message.reactions.map((reaction) => (
													<Pressable
														key={reaction.emoji}
														className="rounded-full bg-black/10 px-2 py-1"
														onPress={() =>
															send("reaction:toggle", {
																messageId: message.id,
																emoji: reaction.emoji,
															})
														}
													>
														<Text>
															{reaction.emoji} {reaction.count}
														</Text>
													</Pressable>
												))}
											</View>
										) : null}
									</Pressable>
									{mine && readers ? (
										<Text className="mt-1 text-right text-xs text-muted">
											{conversation?.type === "GROUP"
												? `Seen by ${readers}`
												: "Seen"}
										</Text>
									) : null}
								</View>
							);
						})}
				</ScrollView>
				{replyTo || editing || attachment ? (
					<View className="mb-2 flex-row items-center justify-between rounded-xl bg-card px-3 py-2">
						<Text className="flex-1 text-sm text-muted" numberOfLines={1}>
							{editing
								? "Editing message"
								: attachment
									? "Image ready to send"
									: `Replying to: ${replyTo?.text}`}
						</Text>
						<Pressable
							accessibilityLabel="Cancel message action"
							onPress={() => {
								setReplyTo(null);
								setEditing(null);
								setAttachment(null);
								setMentionUserIds([]);
								setMentionsEveryone(false);
							}}
						>
							<X color="#6B7280" size={18} />
						</Pressable>
					</View>
				) : null}
				{selectedMembers?.length || mentionsEveryone ? (
					<View className="mb-2 flex-row flex-wrap gap-2">
						{selectedMembers?.map((member) => (
							<Pressable
								key={member.userId}
								className="rounded-full bg-card px-3 py-1"
								onPress={() => removeMention(member)}
							>
								<Text className="text-sm text-primary">
									@{memberName(member)} ×
								</Text>
							</Pressable>
						))}
						{mentionsEveryone ? (
							<Pressable
								className="rounded-full bg-card px-3 py-1"
								onPress={() => setMentionsEveryone(false)}
							>
								<Text className="text-sm text-primary">@everyone ×</Text>
							</Pressable>
						) : null}
					</View>
				) : null}
				{mentionQuery !== undefined && conversation?.type === "GROUP" ? (
					<View className="mb-2 gap-1 rounded-xl bg-card p-2">
						{me?.role === "OWNER" || me?.role === "ADMIN" ? (
							<Pressable
								className="rounded-lg px-2 py-2"
								onPress={() => chooseMention()}
							>
								<Text className="font-medium text-foreground">@everyone</Text>
							</Pressable>
						) : null}
						{mentionMembers.map((member) => (
							<Pressable
								key={member.userId}
								className="rounded-lg px-2 py-2"
								onPress={() => chooseMention(member)}
							>
								<Text className="font-medium text-foreground">
									@{memberName(member)}
								</Text>
							</Pressable>
						))}
					</View>
				) : null}
				{error ? (
					<Text className="mb-2 text-sm text-destructive">{error}</Text>
				) : null}
				<View className="flex-row items-end gap-2 border-t border-border pt-3">
					<Pressable
						accessibilityLabel="Choose image"
						className="size-12 items-center justify-center rounded-xl bg-card"
						disabled={uploading || Boolean(editing)}
						onPress={() => void chooseImage()}
					>
						<ImagePlus color="#6B7280" size={20} />
					</Pressable>
					<TextInput
						className="min-h-12 flex-1 rounded-xl border border-border bg-card px-4 py-3 text-foreground"
						multiline
						placeholder={editing ? "Edit message" : "Write a message"}
						placeholderTextColor="#6B7280"
						value={text}
						onChangeText={onChangeText}
						onSubmitEditing={submit}
					/>
					<Pressable
						accessibilityLabel="Send message"
						className="size-12 items-center justify-center rounded-xl bg-primary"
						onPress={submit}
					>
						<Send color="#FFFFFF" size={20} />
					</Pressable>
				</View>
			</KeyboardAvoidingView>
			{conversation?.type === "GROUP" && user ? (
				<GroupDetails
					conversation={conversation}
					currentUserId={user.id}
					open={groupOpen}
					onOpenChange={setGroupOpen}
				/>
			) : null}
		</Screen>
	);
}

function hasRead(
	receipt: ChatReadReceipt,
	message: ChatMessage,
	newestFirst: ChatMessage[],
) {
	const readIndex = newestFirst.findIndex(
		(item) => item.id === receipt.lastReadMessageId,
	);
	const messageIndex = newestFirst.findIndex((item) => item.id === message.id);
	return readIndex >= 0 && messageIndex >= 0 && readIndex <= messageIndex;
}
