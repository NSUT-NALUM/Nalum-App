import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { PostCard } from "@/components/post-ui";
import { Button, Screen } from "@/components/ui/nalum";
import { postsApi } from "@/lib/api";

export default function MyPosts() {
	const query = useQuery({
		queryKey: ["my-posts"],
		queryFn: () => postsApi.mine({ limit: 50, offset: 0 }),
	});
	return (
		<Screen>
			<ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
				<Button variant="ghost" onPress={() => router.back()}>
					← Back
				</Button>
				<Text
					accessibilityRole="header"
					className="mb-5 mt-3 text-3xl font-bold text-foreground"
				>
					My posts
				</Text>
				{query.isLoading ? (
					<Text className="text-muted">Loading your posts…</Text>
				) : null}
				{query.error ? (
					<View className="items-center gap-3 py-8">
						<Text className="text-muted">Could not load your posts.</Text>
						<Button variant="secondary" onPress={() => query.refetch()}>
							Try again
						</Button>
					</View>
				) : null}
				{!query.isLoading && !query.error && !query.data?.posts.length ? (
					<Text className="text-muted">You have not created any posts.</Text>
				) : null}
				<View className="gap-3">
					{query.data?.posts.map((post) => (
						<PostCard
							key={post.id}
							post={post}
							onPress={() => router.push(`/posts/${post.id}` as never)}
						/>
					))}
				</View>
			</ScrollView>
		</Screen>
	);
}
