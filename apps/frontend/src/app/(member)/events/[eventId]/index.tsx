import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ExternalLink, MapPin, UsersRound } from "lucide-react-native";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import {
	EventGallery,
	EventStatusBadge,
	formatEventDate,
} from "@/components/event-ui";
import { Button, Card, Screen } from "@/components/ui/nalum";
import { useTheme } from "@/hooks/use-theme";
import { eventsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function EventDetail() {
	const { eventId } = useLocalSearchParams<{ eventId: string }>();
	const user = useAuthStore((state) => state.user);
	const queryClient = useQueryClient();
	const theme = useTheme();
	const query = useQuery({
		queryKey: ["event", eventId],
		queryFn: () => eventsApi.get(eventId),
	});
	const join = useMutation<{ eventId: string; isJoined: boolean }>({
		mutationFn: () =>
			query.data?.isJoined ? eventsApi.leave(eventId) : eventsApi.join(eventId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["event", eventId] });
			void queryClient.invalidateQueries({ queryKey: ["events"] });
		},
	});
	const remove = useMutation({
		mutationFn: () => eventsApi.remove(eventId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["events"] });
			void queryClient.invalidateQueries({ queryKey: ["my-events"] });
			router.replace("/events" as never);
		},
	});
	if (query.isLoading)
		return (
			<Screen>
				<Text className="text-muted">Loading event…</Text>
			</Screen>
		);
	if (query.error || !query.data)
		return (
			<Screen>
				<Button variant="ghost" onPress={() => router.back()}>
					← Back
				</Button>
				<Text className="mt-4 text-muted">This event is unavailable.</Text>
			</Screen>
		);
	const event = query.data;
	const isAuthor = event.authorId === user?.id;
	const canRsvp =
		event.status === "PUBLISHED" &&
		new Date(event.startsAt).getTime() > Date.now();
	const deleteEvent = () =>
		Alert.alert(
			"Delete event?",
			"This permanently removes the event and its RSVPs.",
			[
				{ text: "Keep event", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: () => remove.mutate(),
				},
			],
		);
	return (
		<Screen>
			<ScrollView
				contentContainerStyle={{ paddingBottom: 24 }}
				showsVerticalScrollIndicator={false}
			>
				<Button variant="ghost" onPress={() => router.back()}>
					← Back
				</Button>
				<View className="mb-4 mt-3 flex-row items-start justify-between gap-3">
					<Text
						accessibilityRole="header"
						className="flex-1 text-3xl font-bold text-foreground"
					>
						{event.title}
					</Text>
					<EventStatusBadge status={event.status} />
				</View>
				<EventGallery event={event} />
				<View className="mt-5 gap-4">
					<Card>
						<View className="gap-3">
							<Text className="text-base leading-6 text-foreground">
								{event.description}
							</Text>
							<View className="flex-row items-center gap-2">
								<MapPin color={theme.textSecondary} size={18} />
								<Text className="text-muted">{event.venue}</Text>
							</View>
							<Text className="text-muted">
								{formatEventDate(event.startsAt)} –{" "}
								{formatEventDate(event.endsAt)}
							</Text>
							<View className="flex-row items-center gap-2">
								<UsersRound color={theme.textSecondary} size={18} />
								<Text className="text-muted">{event.attendeeCount} going</Text>
							</View>
							{event.meetUrl ? (
								<Button
									variant="secondary"
									onPress={() => void Linking.openURL(event.meetUrl!)}
								>
									<ExternalLink color={theme.primary} size={18} />
									Join online
								</Button>
							) : null}
						</View>
					</Card>
					{event.rejectionReason ? (
						<Card>
							<Text className="font-semibold text-destructive">
								Review feedback
							</Text>
							<Text className="mt-2 text-muted">{event.rejectionReason}</Text>
						</Card>
					) : null}
					{canRsvp ? (
						<Button loading={join.isPending} onPress={() => join.mutate()}>
							{event.isJoined ? "Leave event" : "RSVP"}
						</Button>
					) : null}
					{isAuthor && event.status === "PENDING" ? (
						<View className="gap-3">
							<Button
								variant="secondary"
								onPress={() => router.push(`/events/${event.id}/edit` as never)}
							>
								Edit submission
							</Button>
							<Button
								variant="ghost"
								loading={remove.isPending}
								onPress={deleteEvent}
							>
								Delete submission
							</Button>
						</View>
					) : null}
					{isAuthor ? <Attendees eventId={event.id} /> : null}
				</View>
			</ScrollView>
		</Screen>
	);
}

function Attendees({ eventId }: { eventId: string }) {
	const query = useQuery({
		queryKey: ["event-attendees", eventId],
		queryFn: () => eventsApi.attendees(eventId, { limit: 25, offset: 0 }),
	});
	return (
		<Card>
			<Text className="mb-3 text-lg font-semibold text-foreground">
				Attendees
			</Text>
			{query.isLoading ? (
				<Text className="text-muted">Loading attendees…</Text>
			) : query.error ? (
				<Text className="text-destructive">Could not load attendees.</Text>
			) : query.data?.attendees.length ? (
				<View className="gap-3">
					{query.data.attendees.map((attendee) => (
						<View key={attendee.id}>
							<Text className="font-medium text-foreground">
								{attendee.firstName} {attendee.lastName}
							</Text>
							<Text className="text-sm text-muted">{attendee.email}</Text>
						</View>
					))}
				</View>
			) : (
				<Text className="text-muted">No RSVPs yet.</Text>
			)}
		</Card>
	);
}
