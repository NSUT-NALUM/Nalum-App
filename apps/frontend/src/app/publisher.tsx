import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { PostForm, toPostFormData } from "@/components/post-ui";
import { Button, Card, Field, Screen } from "@/components/ui/nalum";
import {
	authApi,
	type OpportunityType,
	type OpportunityWorkMode,
	opportunitiesApi,
	postsApi,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const today = () => new Date().toISOString().slice(0, 10);

export default function PublisherWorkspace() {
	const client = useQueryClient();
	const user = useAuthStore((state) => state.user);
	const posts = useQuery({
		queryKey: ["publisher-posts"],
		queryFn: () => postsApi.mine({ limit: 50, offset: 0 }),
	});
	const opportunities = useQuery({
		queryKey: ["publisher-opportunities"],
		queryFn: () => opportunitiesApi.mine({ limit: 50, offset: 0 }),
	});
	const [postId, setPostId] = useState<string | null>(null);
	const [opportunityId, setOpportunityId] = useState<string | null>(null);
	const [roleTitle, setRoleTitle] = useState("");
	const [organization, setOrganization] = useState("");
	const [description, setDescription] = useState("");
	const [type, setType] = useState<OpportunityType>("INTERNSHIP");
	const [workMode, setWorkMode] = useState<OpportunityWorkMode>("HYBRID");
	const [location, setLocation] = useState("");
	const [deadline, setDeadline] = useState(today());
	const [applicationUrl, setApplicationUrl] = useState("");
	const [saving, setSaving] = useState<"post" | "opportunity" | null>(null);
	const [error, setError] = useState("");

	const refresh = async () => {
		await Promise.all([
			client.invalidateQueries({ queryKey: ["publisher-posts"] }),
			client.invalidateQueries({ queryKey: ["publisher-opportunities"] }),
		]);
	};
	const resetPost = () => {
		setPostId(null);
	};
	const resetOpportunity = () => {
		setOpportunityId(null);
		setRoleTitle("");
		setOrganization("");
		setDescription("");
		setType("INTERNSHIP");
		setWorkMode("HYBRID");
		setLocation("");
		setDeadline(today());
		setApplicationUrl("");
	};
	const savePost = async (value: Parameters<typeof toPostFormData>[0]) => {
		setSaving("post");
		setError("");
		try {
			const form = toPostFormData(value);
			if (postId) await postsApi.update(postId, form);
			else await postsApi.create(form);
			resetPost();
			await refresh();
		} catch (reason) {
			setError(
				reason instanceof Error ? reason.message : "Could not save post.",
			);
		} finally {
			setSaving(null);
		}
	};
	const selectedPost = postId
		? posts.data?.posts.find((post) => post.id === postId)
		: undefined;
	const saveOpportunity = async () => {
		if (
			!roleTitle.trim() ||
			!organization.trim() ||
			!description.trim() ||
			!location.trim() ||
			!/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
			!/^https:\/\//i.test(applicationUrl.trim())
		) {
			setError(
				"Complete every opportunity field and use an HTTPS application link.",
			);
			return;
		}
		setSaving("opportunity");
		setError("");
		const input = {
			roleTitle: roleTitle.trim(),
			organization: organization.trim(),
			description: description.trim(),
			type,
			workMode,
			location: location.trim(),
			deadline,
			applicationUrl: applicationUrl.trim(),
		};
		try {
			if (opportunityId) await opportunitiesApi.update(opportunityId, input);
			else await opportunitiesApi.create(input);
			resetOpportunity();
			await refresh();
		} catch (reason) {
			setError(
				reason instanceof Error
					? reason.message
					: "Could not save opportunity.",
			);
		} finally {
			setSaving(null);
		}
	};

	return (
		<Screen>
			<ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
				<Text
					accessibilityRole="header"
					className="text-3xl font-bold text-foreground"
				>
					Publisher workspace
				</Text>
				<Text className="mb-5 mt-1 text-muted">
					Publish and track your own posts and opportunities. Each change goes
					back to review.
				</Text>
				{error ? (
					<Text
						accessibilityLiveRegion="assertive"
						className="mb-4 text-sm text-destructive"
					>
						{error}
					</Text>
				) : null}

				<Card>
					<View className="gap-3">
						<Text className="text-lg font-semibold text-foreground">
							{postId ? "Edit post" : "New post"}
						</Text>
						<PostForm
							key={postId ?? "new"}
							post={selectedPost}
							saving={saving === "post"}
							submitLabel={postId ? "Resubmit post" : "Submit post"}
							onSubmit={savePost}
						/>
						{postId ? (
							<Button variant="ghost" onPress={resetPost}>
								Cancel edit
							</Button>
						) : null}
					</View>
				</Card>
				<Text className="mb-2 mt-5 text-lg font-semibold text-foreground">
					Your posts
				</Text>
				<View className="gap-2">
					{posts.data?.posts.map((post) => (
						<Pressable
							key={post.id}
							accessibilityRole="button"
							accessibilityLabel={`Edit ${post.title}`}
							onPress={() => {
								setPostId(post.id);
							}}
						>
							<Card>
								<Text className="font-semibold text-foreground">
									{post.title}
								</Text>
								<Text className="mt-1 text-sm text-muted">{post.status}</Text>
								<ModerationFeedback
									note={post.moderationNote}
									rejectionReason={post.rejectionReason}
								/>
							</Card>
						</Pressable>
					)) ?? <Text className="text-muted">No posts yet.</Text>}
				</View>

				<Card>
					<View className="mt-6 gap-3">
						<Text className="text-lg font-semibold text-foreground">
							{opportunityId ? "Edit opportunity" : "New opportunity"}
						</Text>
						<Field
							label="Role title"
							value={roleTitle}
							onChangeText={setRoleTitle}
							maxLength={200}
						/>
						<Field
							label="Organization"
							value={organization}
							onChangeText={setOrganization}
							maxLength={200}
						/>
						<Field
							label="Description"
							value={description}
							onChangeText={setDescription}
							multiline
							numberOfLines={5}
							maxLength={10000}
						/>
						<Field
							label="Location"
							value={location}
							onChangeText={setLocation}
							maxLength={300}
						/>
						<Field
							label="Deadline (YYYY-MM-DD)"
							value={deadline}
							onChangeText={setDeadline}
							maxLength={10}
						/>
						<Field
							label="HTTPS application link"
							value={applicationUrl}
							onChangeText={setApplicationUrl}
							autoCapitalize="none"
							keyboardType="url"
						/>
						<Choice
							label="Type"
							value={type}
							values={["INTERNSHIP", "JOB"]}
							onChange={setType}
						/>
						<Choice
							label="Work mode"
							value={workMode}
							values={["REMOTE", "HYBRID", "ONSITE"]}
							onChange={setWorkMode}
						/>
						<View className="flex-row flex-wrap gap-2">
							<Button
								loading={saving === "opportunity"}
								onPress={saveOpportunity}
							>
								{opportunityId ? "Resubmit opportunity" : "Submit opportunity"}
							</Button>
							{opportunityId ? (
								<Button variant="ghost" onPress={resetOpportunity}>
									Cancel edit
								</Button>
							) : null}
						</View>
					</View>
				</Card>
				<Text className="mb-2 mt-5 text-lg font-semibold text-foreground">
					Your opportunities
				</Text>
				<View className="gap-2">
					{opportunities.data?.opportunities.map((opportunity) => (
						<Pressable
							key={opportunity.id}
							accessibilityRole="button"
							accessibilityLabel={`Edit ${opportunity.roleTitle}`}
							onPress={() => {
								setOpportunityId(opportunity.id);
								setRoleTitle(opportunity.roleTitle);
								setOrganization(opportunity.organization);
								setDescription(opportunity.description);
								setType(opportunity.type);
								setWorkMode(opportunity.workMode);
								setLocation(opportunity.location);
								setDeadline(opportunity.deadline);
								setApplicationUrl(opportunity.applicationUrl);
							}}
						>
							<Card>
								<Text className="font-semibold text-foreground">
									{opportunity.roleTitle}
								</Text>
								<Text className="mt-1 text-sm text-muted">
									{opportunity.status} · deadline {opportunity.deadline}
								</Text>
								<ModerationFeedback
									note={opportunity.moderationNote}
									rejectionReason={opportunity.rejectionReason}
								/>
							</Card>
						</Pressable>
					)) ?? <Text className="text-muted">No opportunities yet.</Text>}
				</View>
				<Button
					variant="ghost"
					onPress={() => {
						void authApi.logout().finally(() => {
							useAuthStore.getState().setUser(null);
							router.replace("/sign-in");
						});
					}}
				>
					Log out {user?.email ? `(${user.email})` : ""}
				</Button>
			</ScrollView>
		</Screen>
	);
}

function ModerationFeedback({
	note,
	rejectionReason,
}: {
	note: string | null;
	rejectionReason: string | null;
}) {
	if (!note && !rejectionReason) return null;
	return (
		<Text
			className={`mt-1 text-sm ${rejectionReason ? "text-destructive" : "text-muted"}`}
		>
			{rejectionReason ? `Rejection reason: ${rejectionReason}` : note}
		</Text>
	);
}

function Choice<T extends string>({
	label,
	value,
	values,
	onChange,
}: {
	label: string;
	value: T;
	values: readonly T[];
	onChange: (value: T) => void;
}) {
	return (
		<View className="gap-2">
			<Text className="font-medium text-foreground">{label}</Text>
			<View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
				{values.map((choice) => (
					<Button
						key={choice}
						selected={choice === value}
						variant={choice === value ? "primary" : "secondary"}
						onPress={() => onChange(choice)}
					>
						{choice}
					</Button>
				))}
			</View>
		</View>
	);
}
