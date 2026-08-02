import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Flag, Reply } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
	PostForm,
	PostImages,
	PostStatusBadge,
	toPostFormData,
	VoteButtons,
} from "@/components/post-ui";
import { Button, Card, Field, Screen } from "@/components/ui/nalum";
import { type PostComment, postsApi, type VoteDirection } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function PostDetail() {
	const { postId } = useLocalSearchParams<{ postId: string }>();
	const user = useAuthStore((state) => state.user);
	const client = useQueryClient();
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [commentBody, setCommentBody] = useState("");
	const [replyTo, setReplyTo] = useState<PostComment | null>(null);
	const [error, setError] = useState("");
	const postQuery = useQuery({
		queryKey: ["post", postId],
		queryFn: () => postsApi.get(postId),
	});
	const commentsQuery = useQuery({
		queryKey: ["post-comments", postId],
		queryFn: () => postsApi.comments(postId, { limit: 50, offset: 0 }),
		enabled: postQuery.data?.status === "PUBLISHED",
	});
	const refresh = async () => {
		await client.invalidateQueries({ queryKey: ["post", postId] });
		await client.invalidateQueries({ queryKey: ["posts"] });
		await client.invalidateQueries({ queryKey: ["my-posts"] });
		await client.invalidateQueries({ queryKey: ["post-comments", postId] });
	};
	const vote = useMutation<
		void,
		Error,
		{ direction: VoteDirection; current: VoteDirection | null }
	>({
		mutationFn: async ({ direction, current }) => {
			if (current === direction) await postsApi.removePostVote(postId);
			else await postsApi.setPostVote(postId, direction);
		},
		onSuccess: refresh,
	});
	const createComment = useMutation({
		mutationFn: () => postsApi.createComment(postId, commentBody, replyTo?.id),
		onSuccess: async () => {
			setCommentBody("");
			setReplyTo(null);
			await refresh();
		},
	});
	if (postQuery.isLoading)
		return (
			<Screen>
				<Text className="text-muted">Loading post…</Text>
			</Screen>
		);
	if (postQuery.error || !postQuery.data) {
		return (
			<Screen>
				<Button variant="ghost" onPress={() => router.back()}>
					← Back
				</Button>
				<Text className="mt-4 text-muted">This post is unavailable.</Text>
			</Screen>
		);
	}
	const post = postQuery.data;
	const isAuthor = post.authorId === user?.id;
	const canDiscuss = post.status === "PUBLISHED";
	return (
		<Screen>
			<ScrollView
				contentContainerStyle={{ paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Button variant="ghost" onPress={() => router.back()}>
					← Back
				</Button>
				<View className="mt-3 gap-4">
					<View className="flex-row items-start justify-between gap-3">
						<View className="flex-1">
							<Text
								accessibilityRole="header"
								className="text-3xl font-bold text-foreground"
							>
								{post.title}
							</Text>
							<Text className="mt-1 text-muted">
								{post.author.firstName} {post.author.lastName} ·{" "}
								{new Date(post.createdAt).toLocaleString()}
							</Text>
						</View>
						<PostStatusBadge status={post.status} />
					</View>
					<PostImages post={post} />
					<Card>
						<Text className="leading-7 text-foreground">{post.body}</Text>
					</Card>
					{post.status === "PUBLISHED" ? (
						<VoteButtons
							score={post.score}
							myVote={post.myVote}
							onVote={(direction) =>
								vote.mutate({ direction, current: post.myVote })
							}
							disabled={vote.isPending}
						/>
					) : null}
					{post.rejectionReason ? (
						<Card>
							<Text className="font-semibold text-destructive">
								Review feedback
							</Text>
							<Text className="mt-2 text-muted">{post.rejectionReason}</Text>
						</Card>
					) : null}
					{isAuthor && post.status !== "REMOVED" ? (
						editing ? (
							<Card>
								<Text className="mb-4 text-lg font-semibold text-foreground">
									Edit post
								</Text>
								{error ? (
									<Text className="mb-3 text-destructive">{error}</Text>
								) : null}
								<PostForm
									post={post}
									saving={saving}
									submitLabel="Save changes"
									onSubmit={async (value) => {
										setSaving(true);
										setError("");
										try {
											await postsApi.update(post.id, toPostFormData(value));
											setEditing(false);
											await refresh();
										} catch (cause) {
											setError(
												cause instanceof Error
													? cause.message
													: "Could not update post.",
											);
										} finally {
											setSaving(false);
										}
									}}
								/>
								<Button variant="ghost" onPress={() => setEditing(false)}>
									Cancel editing
								</Button>
							</Card>
						) : (
							<Button variant="secondary" onPress={() => setEditing(true)}>
								Edit post
							</Button>
						)
					) : null}
					{canDiscuss ? (
						<ReportPost postId={post.id} onReported={refresh} />
					) : null}
					{canDiscuss ? (
						<View className="mt-2 gap-4">
							<Text className="text-xl font-semibold text-foreground">
								Comments
							</Text>
							<Card>
								<View className="gap-3">
									{replyTo ? (
										<View className="flex-row items-center justify-between gap-3">
											<Text className="flex-1 text-sm text-muted">
												Replying to {replyTo.author.firstName}{" "}
												{replyTo.author.lastName}
											</Text>
											<Button variant="ghost" onPress={() => setReplyTo(null)}>
												Cancel
											</Button>
										</View>
									) : null}
									<Field
										label={replyTo ? "Reply" : "Add a comment"}
										value={commentBody}
										onChangeText={setCommentBody}
										multiline
										numberOfLines={4}
										textAlignVertical="top"
										maxLength={5000}
										placeholder="Join the discussion…"
									/>
									<Button
										disabled={!commentBody.trim()}
										loading={createComment.isPending}
										onPress={() => createComment.mutate()}
									>
										{replyTo ? "Reply" : "Comment"}
									</Button>
								</View>
							</Card>
							{commentsQuery.isLoading ? (
								<Text className="text-muted">Loading comments…</Text>
							) : null}
							{commentsQuery.error ? (
								<Text className="text-destructive">
									Could not load comments.
								</Text>
							) : null}
							{commentsQuery.data?.comments.map((comment) => (
								<CommentThread
									key={comment.id}
									comment={comment}
									currentUserId={user?.id}
									onReply={setReplyTo}
									onChange={refresh}
								/>
							))}
						</View>
					) : null}
				</View>
			</ScrollView>
		</Screen>
	);
}

function CommentThread({
	comment,
	currentUserId,
	onReply,
	onChange,
}: {
	comment: PostComment;
	currentUserId?: string;
	onReply: (comment: PostComment) => void;
	onChange: () => Promise<void>;
}) {
	return (
		<View className="gap-3">
			<CommentRow
				comment={comment}
				currentUserId={currentUserId}
				onReply={onReply}
				onChange={onChange}
			/>
			{comment.replies.map((reply) => (
				<View key={reply.id} className="ml-4 border-l border-border pl-3">
					<CommentRow
						comment={reply}
						currentUserId={currentUserId}
						onChange={onChange}
					/>
				</View>
			))}
		</View>
	);
}

function CommentRow({
	comment,
	currentUserId,
	onReply,
	onChange,
}: {
	comment: PostComment;
	currentUserId?: string;
	onReply?: (comment: PostComment) => void;
	onChange: () => Promise<void>;
}) {
	const [editing, setEditing] = useState(false);
	const [body, setBody] = useState(comment.body ?? "");
	const [reporting, setReporting] = useState(false);
	const [reason, setReason] = useState("");
	const vote = useMutation<void, Error, VoteDirection>({
		mutationFn: async (direction) => {
			if (comment.myVote === direction)
				await postsApi.removeCommentVote(comment.id);
			else await postsApi.setCommentVote(comment.id, direction);
		},
		onSuccess: onChange,
	});
	const update = useMutation({
		mutationFn: () => postsApi.updateComment(comment.id, body),
		onSuccess: async () => {
			setEditing(false);
			await onChange();
		},
	});
	const report = useMutation({
		mutationFn: () => postsApi.reportComment(comment.id, reason),
		onSuccess: async () => {
			setReporting(false);
			setReason("");
			await onChange();
		},
	});
	if (comment.isRemoved)
		return (
			<Card>
				<Text className="italic text-muted">
					Comment removed by an administrator.
				</Text>
			</Card>
		);
	return (
		<Card>
			<View className="gap-3">
				<View className="flex-row items-center justify-between gap-3">
					<Text className="font-semibold text-foreground">
						{comment.author.firstName} {comment.author.lastName}
					</Text>
					<Text className="text-xs text-muted">
						{new Date(comment.createdAt).toLocaleDateString()}
					</Text>
				</View>
				{editing ? (
					<>
						<Field
							label="Edit comment"
							value={body}
							onChangeText={setBody}
							multiline
							numberOfLines={3}
							textAlignVertical="top"
							maxLength={5000}
						/>
						<View className="flex-row gap-2">
							<Button
								loading={update.isPending}
								disabled={!body.trim()}
								onPress={() => update.mutate()}
							>
								Save
							</Button>
							<Button variant="ghost" onPress={() => setEditing(false)}>
								Cancel
							</Button>
						</View>
					</>
				) : (
					<Text className="leading-6 text-foreground">{comment.body}</Text>
				)}
				<View className="flex-row flex-wrap items-center gap-2">
					<VoteButtons
						score={comment.score}
						myVote={comment.myVote}
						onVote={(direction) => vote.mutate(direction)}
						disabled={vote.isPending}
					/>
					{onReply ? (
						<Button variant="ghost" onPress={() => onReply(comment)}>
							<Reply color="#2563EB" size={17} />
							Reply
						</Button>
					) : null}
					{comment.authorId === currentUserId ? (
						<Button variant="ghost" onPress={() => setEditing(true)}>
							Edit
						</Button>
					) : null}
					<Button
						variant="ghost"
						onPress={() => setReporting((value) => !value)}
					>
						<Flag color="#6B7280" size={16} />
						Report
					</Button>
				</View>
				{reporting ? (
					<View className="gap-2">
						<Field
							label="Report reason"
							value={reason}
							onChangeText={setReason}
							multiline
							numberOfLines={2}
							maxLength={1000}
							placeholder="Tell admins what is wrong"
						/>
						<Button
							disabled={!reason.trim()}
							loading={report.isPending}
							onPress={() => report.mutate()}
						>
							Submit report
						</Button>
					</View>
				) : null}
			</View>
		</Card>
	);
}

function ReportPost({
	postId,
	onReported,
}: {
	postId: string;
	onReported: () => Promise<void>;
}) {
	const [reporting, setReporting] = useState(false);
	const [reason, setReason] = useState("");
	const report = useMutation({
		mutationFn: () => postsApi.reportPost(postId, reason),
		onSuccess: async () => {
			setReporting(false);
			setReason("");
			await onReported();
		},
	});
	return (
		<Card>
			<View className="gap-3">
				<Button variant="ghost" onPress={() => setReporting((value) => !value)}>
					<Flag color="#6B7280" size={17} />
					Report post
				</Button>
				{reporting ? (
					<>
						<Field
							label="Report reason"
							value={reason}
							onChangeText={setReason}
							multiline
							numberOfLines={3}
							maxLength={1000}
							placeholder="Tell admins what is wrong"
						/>
						<Button
							disabled={!reason.trim()}
							loading={report.isPending}
							onPress={() => report.mutate()}
						>
							Submit report
						</Button>
					</>
				) : null}
			</View>
		</Card>
	);
}
