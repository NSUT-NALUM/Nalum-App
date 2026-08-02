import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { CalendarPlus } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { EventCard, canCreateEvents } from "@/components/event-ui";
import { Button, Screen } from "@/components/ui/nalum";
import { eventsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function EventsScreen() {
	const user = useAuthStore((state) => state.user);
	const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
	const [offset, setOffset] = useState(0);
	const query = useQuery({
		queryKey: ["events", when, offset],
		queryFn: () => eventsApi.list({ when, limit: 20, offset }),
	});
	const page = query.data;
	const events = page?.events ?? [];
	const canCreate = user ? canCreateEvents(user) : false;

	return (
		<Screen>
			<ScrollView
				contentContainerStyle={{ paddingBottom: 24 }}
				showsVerticalScrollIndicator={false}
			>
				<View className="mb-5 flex-row items-start justify-between gap-3">
					<View className="flex-1">
						<Text
							accessibilityRole="header"
							className="text-3xl font-bold text-foreground"
						>
							Events
						</Text>
						<Text className="mt-1 text-muted">
							Meet the Nalum community in person and online.
						</Text>
					</View>
					{canCreate ? (
						<Button
							accessibilityLabel="Create event"
							onPress={() => router.push("/events/create" as never)}
						>
							<CalendarPlus size={18} color="#FFFFFF" />
							Create
						</Button>
					) : null}
				</View>
				{canCreate ? (
					<Button
						variant="secondary"
						onPress={() => router.push("/events/mine" as never)}
					>
						My events
					</Button>
				) : null}
				<View className="mb-4 mt-4 flex-row gap-2">
					<Button
						variant={when === "upcoming" ? "primary" : "secondary"}
						onPress={() => {
							setWhen("upcoming");
							setOffset(0);
						}}
					>
						Upcoming
					</Button>
					<Button
						variant={when === "past" ? "primary" : "secondary"}
						onPress={() => {
							setWhen("past");
							setOffset(0);
						}}
					>
						Past
					</Button>
				</View>
				{query.isLoading ? (
					<Text className="text-muted">Loading events…</Text>
				) : query.error ? (
					<View className="items-center gap-3 py-8">
						<Text className="text-muted">Could not load events.</Text>
						<Button variant="secondary" onPress={() => query.refetch()}>
							Try again
						</Button>
					</View>
				) : events.length ? (
					<View className="gap-3">
						{events.map((event) => (
							<EventCard
								key={event.id}
								event={event}
								onPress={() => router.push(`/events/${event.id}` as never)}
							/>
						))}
						{page && offset + events.length < page.total ? (
							<Button
								variant="secondary"
								onPress={() => setOffset(offset + page.limit)}
							>
								Load more
							</Button>
						) : null}
					</View>
				) : (
					<View className="items-center py-8">
						<Text className="text-muted">No {when} events yet.</Text>
					</View>
				)}
			</ScrollView>
		</Screen>
	);
}
