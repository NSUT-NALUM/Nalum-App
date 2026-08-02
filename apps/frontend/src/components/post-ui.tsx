import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
	ChevronDown,
	ChevronUp,
	ImagePlus,
	MessageCircle,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, Field } from "@/components/ui/nalum";
import { useTheme } from "@/hooks/use-theme";
import {
	apiImageSource,
	type Post,
	type PostStatus,
	type VoteDirection,
} from "@/lib/api";
import { appendPickedImage } from "@/lib/image-upload";

export function PostStatusBadge({ status }: { status: PostStatus }) {
	const label = status[0] + status.slice(1).toLowerCase();
	return (
		<View
			className={`self-start rounded-full px-3 py-1 ${status === "PUBLISHED" ? "bg-primary" : status === "REJECTED" || status === "REMOVED" ? "bg-destructive" : "bg-secondary"}`}
		>
			<Text
				className={`text-xs font-semibold ${status === "PUBLISHED" || status === "REJECTED" || status === "REMOVED" ? "text-primary-foreground" : "text-foreground"}`}
			>
				{label}
			</Text>
		</View>
	);
}

export function VoteButtons({
	score,
	myVote,
	onVote,
	disabled = false,
}: {
	score: number;
	myVote: VoteDirection | null;
	onVote: (direction: VoteDirection) => void;
	disabled?: boolean;
}) {
	const theme = useTheme();
	return (
		<View className="flex-row items-center rounded-xl border border-border bg-card">
			<Pressable
				accessibilityLabel="Upvote"
				accessibilityState={{ selected: myVote === "UP", disabled }}
				className="size-10 items-center justify-center"
				disabled={disabled}
				onPress={() => onVote("UP")}
			>
				<ChevronUp
					color={myVote === "UP" ? theme.primary : theme.textSecondary}
					size={20}
				/>
			</Pressable>
			<Text
				accessibilityLabel={`${score} vote score`}
				className="min-w-7 text-center font-semibold text-foreground"
			>
				{score}
			</Text>
			<Pressable
				accessibilityLabel="Downvote"
				accessibilityState={{ selected: myVote === "DOWN", disabled }}
				className="size-10 items-center justify-center"
				disabled={disabled}
				onPress={() => onVote("DOWN")}
			>
				<ChevronDown
					color={myVote === "DOWN" ? theme.primary : theme.textSecondary}
					size={20}
				/>
			</Pressable>
		</View>
	);
}

export function PostImages({ post }: { post: Pick<Post, "title" | "images"> }) {
	if (!post.images.length) return null;
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={{ gap: 10 }}
		>
			{post.images.map((image, index) => (
				<Image
					key={image}
					accessibilityLabel={`${post.title} image ${index + 1}`}
					contentFit="cover"
					source={apiImageSource(image)}
					style={{ height: 220, width: 300, borderRadius: 12 }}
				/>
			))}
		</ScrollView>
	);
}

export function PostCard({
	post,
	onPress,
	onVote,
}: {
	post: Post;
	onPress: () => void;
	onVote?: (direction: VoteDirection) => void;
}) {
	return (
		<Card>
			<View className="gap-3">
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`View ${post.title}`}
					onPress={onPress}
				>
					<View className="gap-2">
						<View className="flex-row items-start justify-between gap-3">
							<Text className="flex-1 text-lg font-semibold text-foreground">
								{post.title}
							</Text>
							{post.status !== "PUBLISHED" ? (
								<PostStatusBadge status={post.status} />
							) : null}
						</View>
						<Text className="text-sm text-muted">
							{post.author.firstName} {post.author.lastName} ·{" "}
							{new Date(post.createdAt).toLocaleDateString()}
						</Text>
						{post.images[0] ? (
							<Image
								accessibilityLabel={`${post.title} image`}
								contentFit="cover"
								source={apiImageSource(post.images[0])}
								style={{ height: 168, width: "100%", borderRadius: 12 }}
							/>
						) : null}
						<Text className="leading-6 text-foreground" numberOfLines={3}>
							{post.body}
						</Text>
					</View>
				</Pressable>
				<View className="flex-row items-center justify-between gap-3">
					{onVote ? (
						<VoteButtons
							score={post.score}
							myVote={post.myVote}
							onVote={onVote}
						/>
					) : null}
					<View className="flex-row items-center gap-1">
						<MessageCircle color="#6B7280" size={18} />
						<Text className="text-sm text-muted">{post.commentCount}</Text>
					</View>
				</View>
			</View>
		</Card>
	);
}

export type PostFormValue = {
	title: string;
	body: string;
	images: ImagePicker.ImagePickerAsset[] | null;
};

export const toPostFormData = (value: PostFormValue) => {
	const form = new FormData();
	form.append("title", value.title.trim());
	form.append("body", value.body.trim());
	for (const image of value.images ?? []) {
		appendPickedImage(form, "images", image);
	}
	return form;
};

export function PostForm({
	post,
	saving,
	submitLabel,
	onSubmit,
}: {
	post?: Post;
	saving: boolean;
	submitLabel: string;
	onSubmit: (value: PostFormValue) => Promise<void>;
}) {
	const [title, setTitle] = useState(post?.title ?? "");
	const [body, setBody] = useState(post?.body ?? "");
	const [images, setImages] = useState<ImagePicker.ImagePickerAsset[] | null>(
		post ? null : [],
	);
	const [error, setError] = useState("");
	const chooseImages = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsMultipleSelection: true,
			orderedSelection: true,
			selectionLimit: 10,
			quality: 0.8,
		});
		if (!result.canceled) setImages(result.assets);
	};
	const submit = async () => {
		if (!title.trim() || !body.trim()) {
			setError("Title and body are required.");
			return;
		}
		setError("");
		await onSubmit({ title, body, images });
	};
	return (
		<View className="gap-4">
			<Field
				label="Title"
				value={title}
				onChangeText={setTitle}
				maxLength={200}
				placeholder="What do you want to share?"
			/>
			<Field
				label="Body"
				value={body}
				onChangeText={setBody}
				maxLength={10000}
				multiline
				numberOfLines={7}
				placeholder="Write your post…"
				textAlignVertical="top"
			/>
			<Card>
				<View className="gap-3">
					<Text className="text-lg font-semibold text-foreground">Images</Text>
					<Text className="text-sm text-muted">
						Up to 10 images. Selecting images while editing replaces the current
						set.
					</Text>
					<Button variant="secondary" onPress={() => void chooseImages()}>
						<ImagePlus color="#2563EB" size={18} />
						Choose images
					</Button>
					{images?.length ? (
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={{ gap: 8 }}
						>
							{images.map((image, index) => (
								<Image
									key={image.uri}
									accessibilityLabel={`Selected image ${index + 1}`}
									contentFit="cover"
									source={image.uri}
									style={{ height: 88, width: 88, borderRadius: 10 }}
								/>
							))}
						</ScrollView>
					) : null}
				</View>
			</Card>
			{error ? (
				<Text
					accessibilityLiveRegion="assertive"
					className="text-sm text-destructive"
				>
					{error}
				</Text>
			) : null}
			<Button loading={saving} onPress={() => void submit()}>
				{submitLabel}
			</Button>
		</View>
	);
}
