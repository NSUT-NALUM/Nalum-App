import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { PostForm, toPostFormData } from "@/components/post-ui";
import { Button, Screen } from "@/components/ui/nalum";
import { postsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function CreatePost() {
	const user = useAuthStore((state) => state.user);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	return (
		<Screen>
			<ScrollView
				contentContainerStyle={{ paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
			>
				<Button variant="ghost" onPress={() => router.back()}>
					← Back
				</Button>
				<View className="mb-5 mt-3">
					<Text
						accessibilityRole="header"
						className="text-3xl font-bold text-foreground"
					>
						Create post
					</Text>
					<Text className="mt-1 text-muted">
						{user?.role === "ADMIN"
							? "Your post will publish immediately."
							: "Your post will be submitted for approval."}
					</Text>
				</View>
				{error ? (
					<Text
						accessibilityLiveRegion="assertive"
						className="mb-3 text-destructive"
					>
						{error}
					</Text>
				) : null}
				<PostForm
					saving={saving}
					submitLabel="Submit post"
					onSubmit={async (value) => {
						setSaving(true);
						setError("");
						try {
							const post = await postsApi.create(toPostFormData(value));
							router.replace(`/posts/${post.id}` as never);
						} catch (cause) {
							setError(
								cause instanceof Error
									? cause.message
									: "Could not create post.",
							);
						} finally {
							setSaving(false);
						}
					}}
				/>
			</ScrollView>
		</Screen>
	);
}
