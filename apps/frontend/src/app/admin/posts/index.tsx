import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { AdminShell } from "@/components/admin-shell";
import { PostCard } from "@/components/post-ui";
import { Button, Card } from "@/components/ui/nalum";
import { postsApi } from "@/lib/api";

export default function AdminPosts() {
	const client = useQueryClient();
	const [section, setSection] = useState<"posts" | "reports">("posts");
	const posts = useQuery({
		queryKey: ["admin-posts", "PENDING"],
		queryFn: () => postsApi.adminList({ status: "PENDING", limit: 100 }),
	});
	const reports = useQuery({
		queryKey: ["post-reports", "PENDING"],
		queryFn: () => postsApi.reports({ status: "PENDING", limit: 100 }),
	});
	const refresh = async () => {
		await client.invalidateQueries({ queryKey: ["admin-posts"] });
		await client.invalidateQueries({ queryKey: ["post-reports"] });
		await client.invalidateQueries({ queryKey: ["posts"] });
	};
	const dismiss = useMutation({
		mutationFn: (reportId: string) => postsApi.dismissReport(reportId),
		onSuccess: refresh,
	});
	const remove = useMutation({
		mutationFn: (reportId: string) => postsApi.removeReportedContent(reportId),
		onSuccess: refresh,
	});
	const loading = section === "posts" ? posts.isLoading : reports.isLoading;
	return (
		<AdminShell title="Post moderation">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
			>
				<Button variant="ghost" onPress={() => router.replace("/admin")}>
					← Back to administration
				</Button>
				<View className="mt-4 flex-row flex-wrap gap-2">
					<Button
						variant={section === "posts" ? "primary" : "secondary"}
						onPress={() => setSection("posts")}
					>
						Pending posts ({posts.data?.total ?? 0})
					</Button>
					<Button
						variant={section === "reports" ? "primary" : "secondary"}
						onPress={() => setSection("reports")}
					>
						Open reports ({reports.data?.total ?? 0})
					</Button>
				</View>
				<View className="mt-5 gap-3">
					{loading ? <Text className="text-muted">Loading…</Text> : null}
					{section === "posts" && !loading && !posts.data?.posts.length ? (
						<Card>
							<Text className="text-muted">No posts await approval.</Text>
						</Card>
					) : null}
					{section === "posts"
						? posts.data?.posts.map((post) => (
								<PostCard
									key={post.id}
									post={post}
									onPress={() =>
										router.push(`/admin/posts/${post.id}` as never)
									}
								/>
							))
						: null}
					{section === "reports" &&
					!loading &&
					!reports.data?.reports.length ? (
						<Card>
							<Text className="text-muted">No open reports.</Text>
						</Card>
					) : null}
					{section === "reports"
						? reports.data?.reports.map((report) => {
								const target = report.post
									? `Post: ${report.post.title}`
									: `Comment on ${report.comment?.post.title ?? "a post"}`;
								const author = report.post?.author ?? report.comment?.author;
								return (
									<Card key={report.id}>
										<View className="gap-3">
											<Pressable
												onPress={() =>
													report.post &&
													router.push(`/admin/posts/${report.post.id}` as never)
												}
											>
												<Text className="text-lg font-semibold text-foreground">
													{target}
												</Text>
												<Text className="mt-1 text-muted">
													Reported by {report.reporter.firstName}{" "}
													{report.reporter.lastName}
													{author
														? ` · Created by ${author.firstName} ${author.lastName}`
														: ""}
												</Text>
												<Text className="mt-2 text-foreground">
													{report.reason}
												</Text>
											</Pressable>
											<View className="flex-row flex-wrap gap-2">
												<Button
													variant="secondary"
													loading={dismiss.isPending}
													onPress={() => dismiss.mutate(report.id)}
												>
													Dismiss report
												</Button>
												<Button
													loading={remove.isPending}
													onPress={() =>
														Alert.alert(
															"Remove content?",
															"This hides the reported content and resolves its open reports.",
															[
																{ text: "Cancel", style: "cancel" },
																{
																	text: "Remove",
																	style: "destructive",
																	onPress: () => remove.mutate(report.id),
																},
															],
														)
													}
												>
													Remove content
												</Button>
											</View>
										</View>
									</Card>
								);
							})
						: null}
				</View>
			</ScrollView>
		</AdminShell>
	);
}
