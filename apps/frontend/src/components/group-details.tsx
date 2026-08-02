import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import {
	Alert,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/nalum";
import { type Conversation, chatApi, usersApi } from "@/lib/api";

type Member = Conversation["participants"][number];

export function GroupDetails({
	conversation,
	currentUserId,
	open,
	onOpenChange,
}: {
	conversation: Conversation;
	currentUserId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const me = conversation.participants.find(
		(member) => member.userId === currentUserId,
	);
	const members = new Set(
		conversation.participants.map((member) => member.userId),
	);
	const candidates = useQuery({
		queryKey: ["directory", "group", deferredSearch],
		queryFn: () =>
			usersApi({ q: deferredSearch || undefined, limit: 10, offset: 0 }),
		enabled: Boolean(
			deferredSearch && (me?.role === "OWNER" || me?.role === "ADMIN"),
		),
	});
	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: ["chat"] });
	};
	const invite = useMutation({
		mutationFn: (userId: string) =>
			chatApi.inviteMember(conversation.id, userId),
		onSuccess: () => {
			setSearch("");
			refresh();
		},
	});
	const remove = useMutation({
		mutationFn: (userId: string) =>
			chatApi.removeMember(conversation.id, userId),
		onSuccess: refresh,
	});
	const role = useMutation({
		mutationFn: ({
			userId,
			role,
		}: {
			userId: string;
			role: "ADMIN" | "MEMBER";
		}) => chatApi.updateMemberRole(conversation.id, userId, role),
		onSuccess: refresh,
	});
	const transfer = useMutation({
		mutationFn: (userId: string) =>
			chatApi.transferOwnership(conversation.id, userId),
		onSuccess: refresh,
	});
	const leave = useMutation({
		mutationFn: () => chatApi.leaveGroup(conversation.id),
		onSuccess: () => {
			onOpenChange(false);
			refresh();
		},
	});
	const actionError =
		invite.error ?? remove.error ?? role.error ?? transfer.error ?? leave.error;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85%]">
				<DialogHeader>
					<DialogTitle>{conversation.name}</DialogTitle>
					<DialogDescription>
						{conversation.participants.length} active members
					</DialogDescription>
				</DialogHeader>
				{me?.role === "OWNER" || me?.role === "ADMIN" ? (
					<View className="gap-2">
						<TextInput
							accessibilityLabel="Find a member to invite"
							className="h-11 rounded-xl border border-border bg-card px-3 text-foreground"
							placeholder="Invite from directory"
							placeholderTextColor="#6B7280"
							value={search}
							onChangeText={setSearch}
						/>
						{candidates.data?.users
							.filter((candidate) => !members.has(candidate.id))
							.map((candidate) => (
								<View
									key={candidate.id}
									className="flex-row items-center justify-between rounded-lg bg-card px-3 py-2"
								>
									<Text className="text-foreground">
										{candidate.firstName} {candidate.lastName}
									</Text>
									<Pressable
										accessibilityLabel={`Invite ${candidate.firstName}`}
										disabled={invite.isPending}
										onPress={() => invite.mutate(candidate.id)}
									>
										<Text className="font-semibold text-primary">Invite</Text>
									</Pressable>
								</View>
							))}
					</View>
				) : null}
				<ScrollView className="max-h-72" contentContainerClassName="gap-2">
					{conversation.participants.map((member) => (
						<MemberRow
							key={member.userId}
							member={member}
							canManage={me?.role === "OWNER" || me?.role === "ADMIN"}
							isOwner={me?.role === "OWNER"}
							isSelf={member.userId === currentUserId}
							busy={remove.isPending || role.isPending || transfer.isPending}
							onRemove={() =>
								Alert.alert(
									"Remove member?",
									`${member.user.firstName} will lose access to this group.`,
									[
										{ text: "Cancel", style: "cancel" },
										{
											text: "Remove",
											style: "destructive",
											onPress: () => remove.mutate(member.userId),
										},
									],
								)
							}
							onRole={() =>
								role.mutate({
									userId: member.userId,
									role: member.role === "ADMIN" ? "MEMBER" : "ADMIN",
								})
							}
							onTransfer={() =>
								Alert.alert(
									"Transfer ownership?",
									`${member.user.firstName} will become the group owner.`,
									[
										{ text: "Cancel", style: "cancel" },
										{
											text: "Transfer",
											onPress: () => transfer.mutate(member.userId),
										},
									],
								)
							}
						/>
					))}
				</ScrollView>
				{actionError ? (
					<Text className="text-sm text-destructive">
						{actionError.message}
					</Text>
				) : null}
				{me && me.role !== "OWNER" ? (
					<Button
						loading={leave.isPending}
						variant="secondary"
						onPress={() => leave.mutate()}
					>
						Leave group
					</Button>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function MemberRow({
	member,
	canManage,
	isOwner,
	isSelf,
	busy,
	onRemove,
	onRole,
	onTransfer,
}: {
	member: Member;
	canManage: boolean;
	isOwner: boolean;
	isSelf: boolean;
	busy: boolean;
	onRemove: () => void;
	onRole: () => void;
	onTransfer: () => void;
}) {
	return (
		<View className="rounded-xl bg-card px-3 py-3">
			<View className="flex-row items-center justify-between">
				<Text className="font-medium text-foreground">
					{member.user.firstName} {member.user.lastName}
					{isSelf ? " (you)" : ""}
				</Text>
				<Text className="text-xs font-semibold text-muted">{member.role}</Text>
			</View>
			{!isSelf && canManage && member.role !== "OWNER" ? (
				<View className="mt-2 flex-row gap-3">
					{isOwner ? (
						<Pressable disabled={busy} onPress={onRole}>
							<Text className="font-semibold text-primary">
								{member.role === "ADMIN" ? "Demote" : "Promote"}
							</Text>
						</Pressable>
					) : null}
					{isOwner ? (
						<Pressable disabled={busy} onPress={onTransfer}>
							<Text className="font-semibold text-primary">Transfer</Text>
						</Pressable>
					) : null}
					<Pressable disabled={busy} onPress={onRemove}>
						<Text className="font-semibold text-destructive">Remove</Text>
					</Pressable>
				</View>
			) : null}
		</View>
	);
}
