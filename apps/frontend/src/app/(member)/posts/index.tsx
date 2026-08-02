import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { PenSquare } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { PostCard } from "@/components/post-ui";
import { Button, Screen } from "@/components/ui/nalum";
import { postsApi, type VoteDirection } from "@/lib/api";

export default function PostsScreen() {
	const client = useQueryClient();
	const [offset, setOffset] = useState(0);
	const query = useQuery({
		queryKey: ["posts", offset],
		queryFn: () => postsApi.list({ limit: 20, offset }),
	});
	const vote = useMutation<
		void,
		Error,
		{ postId: string; direction: VoteDirection; current: VoteDirection | null }
	>({
		mutationFn: async ({ postId, direction, current }) => {
			if (current === direction) await postsApi.removePostVote(postId);
			else await postsApi.setPostVote(postId, direction);
		},
		onSuccess: () => void client.invalidateQueries({ queryKey: ["posts"] }),
	});
	const page = query.data;
	return (
		<Screen>
			<ScrollView
				contentContainerStyle={{ paddingBottom: 24 }}
				showsVerticalScrollIndicator={false}
			>
				<View className="mb-5 flex-row items-start justify-between gap-3">
					<View className="flex-1">
						<Text
							accessibilityRole="header"
							className="text-3xl font-bold text-foreground"
						>
							Posts
						</Text>
						<Text className="mt-1 text-muted">
							Ideas, updates, and discussions from the community.
						</Text>
					</View>
					<Button
						accessibilityLabel="Create post"
						onPress={() => router.push("/posts/create" as never)}
					>
						<PenSquare color="#FFFFFF" size={18} />
						Post
					</Button>
				</View>
				<Button
					variant="secondary"
					onPress={() => router.push("/posts/mine" as never)}
				>
					My posts
				</Button>
				<View className="mt-4 gap-3">
					{query.isLoading ? (
						<Text className="text-muted">Loading posts…</Text>
					) : null}
					{query.error ? (
						<View className="items-center gap-3 py-8">
							<Text className="text-muted">Could not load posts.</Text>
							<Button variant="secondary" onPress={() => query.refetch()}>
								Try again
							</Button>
						</View>
					) : null}
					{!query.isLoading && !query.error && !page?.posts.length ? (
						<Text className="py-8 text-center text-muted">
							No posts yet. Start the conversation.
						</Text>
					) : null}
					{page?.posts.map((post) => (
						<PostCard
							key={post.id}
							post={post}
							onPress={() => router.push(`/posts/${post.id}` as never)}
							onVote={(direction) =>
								vote.mutate({
									postId: post.id,
									direction,
									current: post.myVote,
								})
							}
						/>
					))}
					{page && offset + page.posts.length < page.total ? (
						<Button
							variant="secondary"
							onPress={() => setOffset(offset + page.limit)}
						>
							Load more
						</Button>
					) : null}
				</View>
			</ScrollView>
		</Screen>
	);
}
