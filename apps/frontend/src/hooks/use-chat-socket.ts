import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
	createContext,
	createElement,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type ChatMessage,
	type ChatMessagePage,
	type ChatReadReceipt,
	type Conversation,
	getChatToken,
	getChatWebSocketUrl,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export type ChatEvent = { type: string; payload: unknown };
type Presence = { status: "online" | "offline"; lastSeenAt?: string };
type ChatSocketContextValue = {
	send: (type: string, payload: unknown) => boolean;
	subscribe: (listener: (event: ChatEvent) => void) => () => void;
	presence: Record<string, Presence>;
	typing: Record<string, string[]>;
};

const ChatSocketContext = createContext<ChatSocketContextValue | null>(null);

export function ChatSocketProvider({ children }: PropsWithChildren) {
	const socket = useRef<WebSocket | null>(null);
	const listeners = useRef(new Set<(event: ChatEvent) => void>());
	const [presence, setPresence] = useState<Record<string, Presence>>({});
	const [typing, setTyping] = useState<Record<string, string[]>>({});

	const publish = useCallback((event: ChatEvent) => {
		if (event.type === "presence:update") {
			const update = event.payload as {
				userId: string;
				status: "online" | "offline";
				lastSeenAt?: string;
			};
			setPresence((current) => ({
				...current,
				[update.userId]: {
					status: update.status,
					lastSeenAt: update.lastSeenAt,
				},
			}));
		}
		if (event.type === "typing:update") {
			const update = event.payload as {
				conversationId: string;
				userId: string;
				isTyping: boolean;
			};
			setTyping((current) => {
				const users = new Set(current[update.conversationId] ?? []);
				if (update.isTyping) users.add(update.userId);
				else users.delete(update.userId);
				return { ...current, [update.conversationId]: [...users] };
			});
		}
		for (const listener of listeners.current) listener(event);
	}, []);

	useEffect(() => {
		let closed = false;
		let heartbeat: ReturnType<typeof setInterval> | undefined;
		let reconnect: ReturnType<typeof setTimeout> | undefined;
		let attempts = 0;
		const clearHeartbeat = () => {
			if (heartbeat) clearInterval(heartbeat);
			heartbeat = undefined;
		};
		const connect = async (refreshToken = false) => {
			try {
				const [token, url] = await Promise.all([
					getChatToken(refreshToken),
					Promise.resolve(getChatWebSocketUrl()),
				]);
				if (!token || !url || closed) return;
				const connection = new WebSocket(url, ["nalum.chat.v1", token]);
				socket.current = connection;
				connection.onmessage = ({ data }) => {
					try {
						publish(JSON.parse(String(data)) as ChatEvent);
					} catch {
						// Ignore malformed server events.
					}
				};
				connection.onopen = () => {
					attempts = 0;
					clearHeartbeat();
					heartbeat = setInterval(() => {
						if (connection.readyState === WebSocket.OPEN)
							connection.send(
								JSON.stringify({ type: "presence:heartbeat", payload: {} }),
							);
					}, 30_000);
				};
				connection.onclose = () => {
					clearHeartbeat();
					if (closed) return;
					const delay = Math.min(30_000, 1_000 * 2 ** attempts++);
					reconnect = setTimeout(
						() => void connect(true),
						delay * (0.75 + Math.random() * 0.5),
					);
				};
			} catch {
				if (!closed) reconnect = setTimeout(() => void connect(true), 1_000);
			}
		};
		void connect();
		return () => {
			closed = true;
			clearHeartbeat();
			if (reconnect) clearTimeout(reconnect);
			socket.current?.close();
			socket.current = null;
		};
	}, [publish]);

	const value = useMemo<ChatSocketContextValue>(
		() => ({
			send: (type, payload) => {
				if (socket.current?.readyState !== WebSocket.OPEN) return false;
				socket.current.send(JSON.stringify({ type, payload }));
				return true;
			},
			subscribe: (listener) => {
				listeners.current.add(listener);
				return () => listeners.current.delete(listener);
			},
			presence,
			typing,
		}),
		[presence, typing],
	);

	return createElement(ChatSocketContext.Provider, { value }, children);
}

export function useChatSocket(onEvent: (event: ChatEvent) => void) {
	const context = useContext(ChatSocketContext);
	if (!context)
		throw new Error("useChatSocket must be used inside ChatSocketProvider");
	const onEventRef = useRef(onEvent);
	onEventRef.current = onEvent;
	useEffect(
		() => context.subscribe((event) => onEventRef.current(event)),
		[context],
	);
	return context.send;
}

export function useChatRealtime() {
	const context = useContext(ChatSocketContext);
	if (!context)
		throw new Error("useChatRealtime must be used inside ChatSocketProvider");
	return { presence: context.presence, typing: context.typing };
}

type MessagePages = InfiniteData<ChatMessagePage, string | undefined>;

const updateMessage = (
	current: MessagePages | undefined,
	message: ChatMessage,
	insert: boolean,
) => {
	if (!current) return current;
	const exists = current.pages.some((page) =>
		page.messages.some((item) => item.id === message.id),
	);
	return {
		...current,
		pages: current.pages.map((page, index) => ({
			...page,
			messages: page.messages.some((item) => item.id === message.id)
				? page.messages.map((item) => (item.id === message.id ? message : item))
				: index === 0 && insert && !exists
					? [message, ...page.messages]
					: page.messages,
		})),
	};
};

export function ChatEventBridge() {
	const queryClient = useQueryClient();
	const user = useAuthStore((state) => state.user);
	useChatSocket((event) => {
		if (
			event.type === "message:new" ||
			event.type === "message:accepted" ||
			event.type === "message:updated" ||
			event.type === "message:deleted"
		) {
			const message = event.payload as ChatMessage;
			queryClient.setQueryData<MessagePages>(
				["chat", "messages", message.conversationId],
				(current) =>
					updateMessage(
						current,
						message,
						event.type === "message:new" || event.type === "message:accepted",
					),
			);
			void queryClient.invalidateQueries({
				queryKey: ["chat", "conversations"],
			});
			return;
		}
		if (event.type === "reaction:updated") {
			const reaction = event.payload as {
				conversationId: string;
				messageId: string;
				emoji: string;
				count: number;
				active: boolean;
				userId: string;
			};
			queryClient.setQueryData<MessagePages>(
				["chat", "messages", reaction.conversationId],
				(current) => {
					if (!current) return current;
					return {
						...current,
						pages: current.pages.map((page) => ({
							...page,
							messages: page.messages.map((message) => {
								if (message.id !== reaction.messageId) return message;
								const previous = message.reactions.find(
									(item) => item.emoji === reaction.emoji,
								);
								const nextReaction = {
									emoji: reaction.emoji,
									count: reaction.count,
									reactedByMe:
										reaction.userId === user?.id
											? reaction.active
											: (previous?.reactedByMe ?? false),
								};
								return {
									...message,
									reactions: reaction.count
										? [
												...message.reactions.filter(
													(item) => item.emoji !== reaction.emoji,
												),
												nextReaction,
											]
										: message.reactions.filter(
												(item) => item.emoji !== reaction.emoji,
											),
								};
							}),
						})),
					};
				},
			);
			return;
		}
		if (event.type === "receipt:updated") {
			const receipt = event.payload as ChatReadReceipt & {
				conversationId: string;
			};
			queryClient.setQueryData<MessagePages>(
				["chat", "messages", receipt.conversationId],
				(current) =>
					current
						? {
								...current,
								pages: current.pages.map((page) => ({
									...page,
									readReceipts: [
										...page.readReceipts.filter(
											(item) => item.userId !== receipt.userId,
										),
										receipt,
									],
								})),
							}
						: current,
			);
			return;
		}
		if (event.type === "conversation:membership-updated") {
			const update = event.payload as {
				conversationId: string;
				member: {
					userId: string;
					role: "OWNER" | "ADMIN" | "MEMBER";
					joinedAt: string;
					leftAt: string | null;
					user: { firstName: string; lastName: string | null };
				};
			};
			if (update.member.userId === user?.id && update.member.leftAt) {
				queryClient.removeQueries({
					queryKey: ["chat", "messages", update.conversationId],
				});
				router.replace("/chats" as never);
			}
			queryClient.setQueryData<{ conversations: Conversation[] }>(
				["chat", "conversations"],
				(current) =>
					current
						? {
								conversations: current.conversations
									.filter(
										(conversation) =>
											!(
												update.member.userId === user?.id &&
												update.member.leftAt &&
												conversation.id === update.conversationId
											),
									)
									.map((conversation) => {
										if (conversation.id !== update.conversationId)
											return conversation;
										const existing = conversation.participants.find(
											(item) => item.userId === update.member.userId,
										);
										const participant = {
											...update.member,
											lastReadMessageId: existing?.lastReadMessageId ?? null,
											lastReadAt: existing?.lastReadAt ?? null,
											user: update.member.user,
										};
										return {
											...conversation,
											participants: update.member.leftAt
												? conversation.participants.filter(
														(item) => item.userId !== update.member.userId,
													)
												: [
														...conversation.participants.filter(
															(item) => item.userId !== update.member.userId,
														),
														participant,
													],
										};
									}),
							}
						: current,
			);
		}
		if (
			event.type === "connection-request:new" ||
			event.type === "connection-request:updated" ||
			event.type === "group-invitation:new" ||
			event.type === "group-invitation:updated" ||
			event.type === "message:mention" ||
			event.type === "conversation:membership-updated"
		)
			void queryClient.invalidateQueries({ queryKey: ["chat"] });
	});
	return null;
}
