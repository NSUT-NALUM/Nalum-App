import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { EventCard } from "@/components/event-ui";
import { Button, Screen } from "@/components/ui/nalum";
import { eventsApi } from "@/lib/api";

export default function MyEvents() {
	const query = useQuery({
		queryKey: ["my-events"],
		queryFn: () => eventsApi.mine({ limit: 50, offset: 0 }),
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
					My events
				</Text>
				{query.isLoading ? (
					<Text className="text-muted">Loading your events…</Text>
				) : query.error ? (
					<View className="items-center gap-3 py-8">
						<Text className="text-muted">Could not load your events.</Text>
						<Button variant="secondary" onPress={() => query.refetch()}>
							Try again
						</Button>
					</View>
				) : query.data?.events.length ? (
					<View className="gap-3">
						{query.data.events.map((event) => (
							<EventCard
								key={event.id}
								event={event}
								onPress={() => router.push(`/events/${event.id}` as never)}
							/>
						))}
					</View>
				) : (
					<Text className="text-muted">You have not created any events.</Text>
				)}
			</ScrollView>
		</Screen>
	);
}
