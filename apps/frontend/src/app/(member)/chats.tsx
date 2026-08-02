import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { useDeferredValue, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button, Card, Screen } from "@/components/ui/nalum";
import { useChatRealtime } from "@/hooks/use-chat-socket";
import {
	type ConnectionRequest,
	type Conversation,
	chatApi,
	type GroupInvitation,
	type User,
	usersApi,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const requestName = (request: ConnectionRequest, currentUserId: string) => {
	const person =
		request.requesterId === currentUserId
			? request.recipient
			: request.requester;
	return `${person.firstName} ${person.lastName}`;
};

export default function Chats() {
	const [section, setSection] = useState<"chats" | "requests">("chats");
	const [groupOpen, setGroupOpen] = useState(false);
	const [groupName, setGroupName] = useState("");
	const [memberSearch, setMemberSearch] = useState("");
	const [invitees, setInvitees] = useState<User[]>([]);
	const search = useDeferredValue(memberSearch.trim());
	const user = useAuthStore((state) => state.user);
	const { presence, typing } = useChatRealtime();
	const queryClient = useQueryClient();
	const conversations = useQuery({
		queryKey: ["chat", "conversations"],
		queryFn: chatApi.conversations,
	});
	const incoming = useQuery({
		queryKey: ["chat", "requests", "incoming"],
		queryFn: () => chatApi.requests("incoming"),
	});
	const outgoing = useQuery({
		queryKey: ["chat", "requests", "outgoing"],
		queryFn: () => chatApi.requests("outgoing"),
	});
	const groupInvitations = useQuery({
		queryKey: ["chat", "group-invitations"],
		queryFn: chatApi.groupInvitations,
	});
	const directory = useQuery({
		queryKey: ["directory", "group-create", search],
		queryFn: () => usersApi({ q: search || undefined, limit: 10, offset: 0 }),
		enabled: groupOpen && Boolean(search),
	});
	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: ["chat"] });
	};
	const accept = useMutation({
		mutationFn: chatApi.acceptRequest,
		onSuccess: ({ conversation }) => {
			refresh();
			router.push(`./chat/${conversation.id}` as never);
		},
	});
	const decline = useMutation({
		mutationFn: chatApi.declineRequest,
		onSuccess: refresh,
	});
	const acceptGroup = useMutation({
		mutationFn: chatApi.acceptGroupInvitation,
		onSuccess: (_result, invitationId) => {
			const invitation = groupInvitations.data?.find(
				(item) => item.id === invitationId,
			);
			refresh();
			if (invitation)
				router.push(`./chat/${invitation.conversationId}` as never);
		},
	});
	const declineGroup = useMutation({
		mutationFn: chatApi.declineGroupInvitation,
		onSuccess: refresh,
	});
	const createGroup = useMutation({
		mutationFn: () =>
			chatApi.createGroup(
				groupName.trim(),
				invitees.map((user) => user.id),
			),
		onSuccess: (group) => {
			setGroupOpen(false);
			setGroupName("");
			setMemberSearch("");
			setInvitees([]);
			refresh();
			router.push(`./chat/${group.id}` as never);
		},
	});
	const pendingIncoming =
		(incoming.data?.length ?? 0) + (groupInvitations.data?.length ?? 0);

	return (
		<Screen>
			<View className="mb-5 flex-row items-center justify-between">
				<View>
					<Text
						accessibilityRole="header"
						className="text-3xl font-bold text-foreground"
					>
						Chats
					</Text>
					<Text className="mt-1 text-muted">
						Connect first, then start a conversation.
					</Text>
				</View>
				<Pressable
					accessibilityLabel="Create group"
					className="size-11 items-center justify-center rounded-xl bg-primary"
					onPress={() => setGroupOpen(true)}
				>
					<Plus color="#FFFFFF" size={22} />
				</Pressable>
			</View>
			<View className="mb-4 flex-row rounded-xl bg-card p-1">
				{(["chats", "requests"] as const).map((item) => (
					<Pressable
						key={item}
						className={`h-10 flex-1 items-center justify-center rounded-lg ${section === item ? "bg-primary" : ""}`}
						onPress={() => setSection(item)}
					>
						<Text
							className={
								section === item
									? "font-semibold text-white"
									: "font-semibold text-muted"
							}
						>
							{item === "chats"
								? "Chats"
								: `Requests${pendingIncoming ? ` (${pendingIncoming})` : ""}`}
						</Text>
					</Pressable>
				))}
			</View>
			<ScrollView contentContainerClassName="gap-3 pb-6">
				{section === "chats" ? (
					conversations.data?.conversations.length || outgoing.data?.length ? (
						<>
							{conversations.data?.conversations.map((conversation) => (
								<ConversationCard
									key={conversation.id}
									conversation={conversation}
									currentUserId={user?.id ?? ""}
									presence={presence}
									typing={typing[conversation.id] ?? []}
									onPress={() =>
										router.push(`./chat/${conversation.id}` as never)
									}
								/>
							))}
							{outgoing.data?.map((request) => (
								<RequestCard
									key={request.id}
									request={request}
									currentUserId={user?.id ?? ""}
								/>
							))}
						</>
					) : (
						<Text className="mt-8 text-center text-muted">
							No chats yet. Find someone in Directory to connect.
						</Text>
					)
				) : (
					<>
						{groupInvitations.data?.map((invitation) => (
							<GroupInvitationCard
								key={invitation.id}
								invitation={invitation}
								onAccept={() => acceptGroup.mutate(invitation.id)}
								onDecline={() => declineGroup.mutate(invitation.id)}
								loading={acceptGroup.isPending || declineGroup.isPending}
							/>
						))}
						{incoming.data?.map((request) => (
							<RequestCard
								key={request.id}
								request={request}
								currentUserId={user?.id ?? ""}
								onAccept={() => accept.mutate(request.id)}
								onDecline={() => decline.mutate(request.id)}
								loading={accept.isPending || decline.isPending}
							/>
						))}
						{!incoming.data?.length && !groupInvitations.data?.length ? (
							<Text className="mt-8 text-center text-muted">No requests.</Text>
						) : null}
					</>
				)}
			</ScrollView>
			<Dialog open={groupOpen} onOpenChange={setGroupOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create group</DialogTitle>
						<DialogDescription>
							Selected members receive an invitation before joining.
						</DialogDescription>
					</DialogHeader>
					<TextInput
						accessibilityLabel="Group name"
						className="h-12 rounded-xl border border-border bg-card px-4 text-foreground"
						placeholder="Group name"
						placeholderTextColor="#6B7280"
						value={groupName}
						onChangeText={setGroupName}
					/>
					<TextInput
						accessibilityLabel="Find group members"
						className="h-12 rounded-xl border border-border bg-card px-4 text-foreground"
						placeholder="Search the directory"
						placeholderTextColor="#6B7280"
						value={memberSearch}
						onChangeText={setMemberSearch}
					/>
					{invitees.length ? (
						<View className="flex-row flex-wrap gap-2">
							{invitees.map((invitee) => (
								<Pressable
									key={invitee.id}
									className="rounded-full bg-card px-3 py-1"
									onPress={() =>
										setInvitees((current) =>
											current.filter((item) => item.id !== invitee.id),
										)
									}
								>
									<Text className="text-sm text-primary">
										{invitee.firstName} {invitee.lastName} ×
									</Text>
								</Pressable>
							))}
						</View>
					) : null}
					{directory.data?.users
						.filter(
							(candidate) =>
								candidate.id !== user?.id &&
								!invitees.some((item) => item.id === candidate.id),
						)
						.map((candidate) => (
							<Pressable
								key={candidate.id}
								className="flex-row items-center justify-between rounded-xl bg-card px-3 py-3"
								onPress={() =>
									setInvitees((current) => [...current, candidate])
								}
							>
								<Text className="text-foreground">
									{candidate.firstName} {candidate.lastName}
								</Text>
								<Plus color="#2563EB" size={18} />
							</Pressable>
						))}
					{createGroup.error ? (
						<Text className="text-sm text-destructive">
							{createGroup.error.message}
						</Text>
					) : null}
					<DialogFooter>
						<Button
							disabled={!groupName.trim() || !invitees.length}
							loading={createGroup.isPending}
							onPress={() => createGroup.mutate()}
						>
							Create and invite
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Screen>
	);
}

function ConversationCard({
	conversation,
	currentUserId,
	presence,
	typing,
	onPress,
}: {
	conversation: Conversation;
	currentUserId: string;
	presence: Record<string, { status: "online" | "offline" }>;
	typing: string[];
	onPress: () => void;
}) {
	const other = conversation.participants.find(
		(participant) => participant.userId !== currentUserId,
	);
	const typingMember = conversation.participants.find((member) =>
		typing.includes(member.userId),
	);
	const title =
		conversation.name ??
		(other ? `${other.user.firstName} ${other.user.lastName}` : "Conversation");
	return (
		<Pressable onPress={onPress}>
			<Card>
				<View className="flex-row items-center justify-between gap-3">
					<View className="flex-1">
						<Text className="text-lg font-semibold text-foreground">
							{title}
						</Text>
						<Text className="mt-1 text-muted" numberOfLines={1}>
							{typingMember
								? `${typingMember.user.firstName} is typing…`
								: (conversation.messages[0]?.text ?? "No messages yet")}
						</Text>
					</View>
					{conversation.type === "DIRECT" && other ? (
						<View
							accessibilityLabel={
								presence[other.userId]?.status === "online"
									? "Online"
									: "Offline"
							}
							className={`size-2 rounded-full ${presence[other.userId]?.status === "online" ? "bg-green-500" : "bg-muted"}`}
						/>
					) : null}
				</View>
				{conversation.unreadCount ? (
					<View className="mt-3 flex-row gap-2">
						<Text className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-white">
							{conversation.unreadCount}
						</Text>
						{conversation.unreadMentionCount ? (
							<Text className="rounded-full bg-card px-2 py-1 text-xs font-semibold text-primary">
								@ {conversation.unreadMentionCount}
							</Text>
						) : null}
					</View>
				) : null}
			</Card>
		</Pressable>
	);
}

function GroupInvitationCard({
	invitation,
	onAccept,
	onDecline,
	loading,
}: {
	invitation: GroupInvitation;
	onAccept: () => void;
	onDecline: () => void;
	loading: boolean;
}) {
	return (
		<Card>
			<Text className="text-lg font-semibold text-foreground">
				{invitation.conversation.name}
			</Text>
			<Text className="mt-2 text-muted">
				{invitation.inviter.firstName} {invitation.inviter.lastName} invited you
				to join.
			</Text>
			<View className="mt-4 flex-row gap-3">
				<View className="flex-1">
					<Button loading={loading} onPress={onAccept}>
						Join
					</Button>
				</View>
				<View className="flex-1">
					<Button variant="secondary" disabled={loading} onPress={onDecline}>
						Decline
					</Button>
				</View>
			</View>
		</Card>
	);
}

function RequestCard({
	request,
	currentUserId,
	onAccept,
	onDecline,
	loading,
}: {
	request: ConnectionRequest;
	currentUserId: string;
	onAccept?: () => void;
	onDecline?: () => void;
	loading?: boolean;
}) {
	const incoming = request.recipientId === currentUserId;
	return (
		<Card>
			<Text className="text-lg font-semibold text-foreground">
				{requestName(request, currentUserId)}
			</Text>
			<Text className="mt-2 text-muted">{request.text}</Text>
			{incoming ? (
				<View className="mt-4 flex-row gap-3">
					<View className="flex-1">
						<Button loading={loading} onPress={onAccept}>
							Accept
						</Button>
					</View>
					<View className="flex-1">
						<Button variant="secondary" disabled={loading} onPress={onDecline}>
							Decline
						</Button>
					</View>
				</View>
			) : (
				<Text className="mt-4 text-sm font-medium text-muted">
					Awaiting response
				</Text>
			)}
		</Card>
	);
}
