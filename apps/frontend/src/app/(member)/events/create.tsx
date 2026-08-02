import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import {
	EventForm,
	canCreateEvents,
	toEventFormData,
} from "@/components/event-ui";
import { Button, Screen } from "@/components/ui/nalum";
import { eventsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useState } from "react";

export default function CreateEvent() {
	const user = useAuthStore((state) => state.user);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	if (!user || !canCreateEvents(user)) {
		return (
			<Screen>
				<Text className="text-muted">
					Only verified alumni and administrators can create events.
				</Text>
			</Screen>
		);
	}
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
						Create event
					</Text>
					<Text className="mt-1 text-muted">
						{user.role === "ADMIN"
							? "Your event will publish immediately."
							: "Your event will be submitted for review."}
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
				<EventForm
					saving={saving}
					submitLabel="Create event"
					onSubmit={async (value) => {
						setSaving(true);
						setError("");
						try {
							const event = await eventsApi.create(toEventFormData(value));
							router.replace(`/events/${event.id}` as never);
						} catch (reason) {
							setError(
								reason instanceof Error
									? reason.message
									: "Could not create event.",
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
