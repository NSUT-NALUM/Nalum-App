import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { AdminShell } from "@/components/admin-shell";
import { PostImages, PostStatusBadge } from "@/components/post-ui";
import { Button, Card, Field } from "@/components/ui/nalum";
import { postsApi } from "@/lib/api";

export default function AdminPostDetail() {
	const { postId } = useLocalSearchParams<{ postId: string }>();
	const client = useQueryClient();
	const [note, setNote] = useState("");
	const [reason, setReason] = useState("");
	const query = useQuery({
		queryKey: ["post", postId],
		queryFn: () => postsApi.get(postId),
	});
	const refresh = async () => {
		await client.invalidateQueries({ queryKey: ["post", postId] });
		await client.invalidateQueries({ queryKey: ["admin-posts"] });
		await client.invalidateQueries({ queryKey: ["posts"] });
	};
	const approve = useMutation({
		mutationFn: () => postsApi.approve(postId, note),
		onSuccess: refresh,
	});
	const reject = useMutation({
		mutationFn: () => postsApi.reject(postId, reason),
		onSuccess: refresh,
	});
	if (query.isLoading)
		return (
			<AdminShell title="Post moderation">
				<Text className="p-6 text-muted">Loading post…</Text>
			</AdminShell>
		);
	if (query.error || !query.data)
		return (
			<AdminShell title="Post moderation">
				<View className="p-6">
					<Button
						variant="ghost"
						onPress={() => router.replace("/admin/posts")}
					>
						← Back to post moderation
					</Button>
					<Text className="mt-4 text-muted">This post is unavailable.</Text>
				</View>
			</AdminShell>
		);
	const post = query.data;
	return (
		<AdminShell title="Post moderation">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
			>
				<Button variant="ghost" onPress={() => router.replace("/admin/posts")}>
					← Back to post moderation
				</Button>
				<View className="mt-4 gap-4">
					<View className="flex-row items-start justify-between gap-3">
						<View className="flex-1">
							<Text
								accessibilityRole="header"
								className="text-3xl font-bold text-foreground"
							>
								{post.title}
							</Text>
							<Text className="mt-1 text-muted">
								Created by {post.author.firstName} {post.author.lastName}
							</Text>
						</View>
						<PostStatusBadge status={post.status} />
					</View>
					<PostImages post={post} />
					<Card>
						<Text className="leading-7 text-foreground">{post.body}</Text>
					</Card>
					{post.status === "PENDING" ? (
						<Card>
							<View className="gap-3">
								<Text className="text-lg font-semibold text-foreground">
									Review post
								</Text>
								<Field
									label="Approval note (optional)"
									value={note}
									onChangeText={setNote}
									maxLength={1000}
									placeholder="Visible to the author"
								/>
								<Button
									loading={approve.isPending}
									onPress={() => approve.mutate()}
								>
									Approve and publish
								</Button>
								<Field
									label="Rejection reason"
									value={reason}
									onChangeText={setReason}
									multiline
									numberOfLines={3}
									maxLength={1000}
									placeholder="Required to reject"
								/>
								<Button
									variant="secondary"
									disabled={!reason.trim()}
									loading={reject.isPending}
									onPress={() => reject.mutate()}
								>
									Reject post
								</Button>
							</View>
						</Card>
					) : null}
					{post.rejectionReason ? (
						<Card>
							<Text className="font-semibold text-destructive">
								Rejection reason
							</Text>
							<Text className="mt-2 text-muted">{post.rejectionReason}</Text>
						</Card>
					) : null}
				</View>
			</ScrollView>
		</AdminShell>
	);
}
