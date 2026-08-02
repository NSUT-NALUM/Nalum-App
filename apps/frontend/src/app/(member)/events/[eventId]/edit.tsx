import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { EventForm, toEventFormData } from "@/components/event-ui";
import { Button, Screen } from "@/components/ui/nalum";
import { eventsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function EditEvent() {
	const { eventId } = useLocalSearchParams<{ eventId: string }>();
	const user = useAuthStore((state) => state.user);
	const client = useQueryClient();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const query = useQuery({
		queryKey: ["event", eventId],
		queryFn: () => eventsApi.get(eventId),
	});
	if (query.isLoading)
		return (
			<Screen>
				<Text className="text-muted">Loading event…</Text>
			</Screen>
		);
	if (
		!query.data ||
		query.data.authorId !== user?.id ||
		query.data.status !== "PENDING"
	)
		return (
			<Screen>
				<Text className="text-muted">This event can no longer be edited.</Text>
			</Screen>
		);
	return (
		<Screen>
			<ScrollView
				contentContainerStyle={{ paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
			>
				<View className="mb-5">
					<Button variant="ghost" onPress={() => router.back()}>
						← Back
					</Button>
					<Text
						accessibilityRole="header"
						className="mt-3 text-3xl font-bold text-foreground"
					>
						Edit event
					</Text>
				</View>
				{error ? <Text className="mb-3 text-destructive">{error}</Text> : null}
				<EventForm
					event={query.data}
					saving={saving}
					submitLabel="Save changes"
					onSubmit={async (value) => {
						setSaving(true);
						setError("");
						try {
							await eventsApi.update(eventId, toEventFormData(value));
							await client.invalidateQueries({ queryKey: ["event", eventId] });
							await client.invalidateQueries({ queryKey: ["my-events"] });
							router.back();
						} catch (reason) {
							setError(
								reason instanceof Error
									? reason.message
									: "Could not save event.",
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
