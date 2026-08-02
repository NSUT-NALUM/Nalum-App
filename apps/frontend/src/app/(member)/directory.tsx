import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react-native";
import { useDeferredValue, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { MemberCard, MemberCardSkeleton } from "@/components/member-card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button, Screen } from "@/components/ui/nalum";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/hooks/use-theme";
import { chatApi, type User, usersApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function Directory() {
	const [q, setQ] = useState("");
	const search = useDeferredValue(q.trim());
	const theme = useTheme();
	const currentUser = useAuthStore((state) => state.user);
	const [target, setTarget] = useState<User | null>(null);
	const [intro, setIntro] = useState("");
	const connect = useMutation({
		mutationFn: () => chatApi.createRequest(target!.id, intro),
		onSuccess: () => {
			setTarget(null);
			setIntro("");
		},
	});
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["directory", search],
		queryFn: () => usersApi({ q: search || undefined, limit: 30, offset: 0 }),
	});

	return (
		<Screen>
			<View className="mb-5">
				<Text
					accessibilityRole="header"
					className="text-3xl font-bold text-foreground"
				>
					Directory
				</Text>
				<Text className="mt-1 text-muted">
					Find people across the Nalum community.
				</Text>
			</View>
			<View className="mb-3 h-12 flex-row items-center gap-3 rounded-xl border border-border bg-card px-4">
				<Search color={theme.textSecondary} size={20} />
				<TextInput
					accessibilityLabel="Search directory"
					className="h-12 flex-1 text-base text-foreground"
					placeholder="Name, company, or city"
					placeholderTextColor={theme.textSecondary}
					returnKeyType="search"
					value={q}
					onChangeText={setQ}
				/>
				{q ? (
					<Pressable
						accessibilityLabel="Clear search"
						className="size-11 items-center justify-center"
						hitSlop={4}
						onPress={() => setQ("")}
					>
						<X color={theme.textSecondary} size={20} />
					</Pressable>
				) : null}
			</View>
			<Text
				accessibilityLiveRegion="polite"
				className="mb-4 text-sm text-muted"
			>
				{isLoading ? "Loading members…" : `${data?.total ?? 0} members`}
			</Text>
			{isLoading ? (
				<View>
					<MemberCardSkeleton />
					<MemberCardSkeleton />
					<MemberCardSkeleton />
				</View>
			) : error ? (
				<View className="mt-8 items-center gap-4">
					<Text className="text-center text-muted">
						Could not load the directory.
					</Text>
					<Button variant="secondary" onPress={() => refetch()}>
						Try again
					</Button>
				</View>
			) : (
				<FlashList
					data={data?.users ?? []}
					keyboardShouldPersistTaps="handled"
					renderItem={({ item }) => (
						<View className="mb-3">
							<MemberCard
								user={item}
								onConnect={
									item.id === currentUser?.id
										? undefined
										: () => setTarget(item)
								}
							/>
						</View>
					)}
					ListEmptyComponent={
						<View className="mt-8 items-center gap-4">
							<Text className="text-center text-muted">
								{search
									? `No members match “${search}”.`
									: "No members are available yet."}
							</Text>
							{search ? (
								<Button variant="secondary" onPress={() => setQ("")}>
									Clear search
								</Button>
							) : null}
						</View>
					}
				/>
			)}
			<Dialog
				open={Boolean(target)}
				onOpenChange={(open) => !open && setTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Connect with {target?.firstName}</DialogTitle>
						<DialogDescription>
							Introduce yourself before they can accept a chat.
						</DialogDescription>
					</DialogHeader>
					<Textarea
						accessibilityLabel="Introduction message"
						maxLength={4000}
						placeholder="Hey, I’d like to connect because…"
						value={intro}
						onChangeText={setIntro}
					/>
					{connect.error ? (
						<Text className="text-sm text-destructive">
							{connect.error.message}
						</Text>
					) : null}
					<DialogFooter>
						<Button
							disabled={!intro.trim()}
							loading={connect.isPending}
							onPress={() => connect.mutate()}
						>
							Send request
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Screen>
	);
}
