import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { AdminShell } from "@/components/admin-shell";
import {
	EventForm,
	EventGallery,
	EventStatusBadge,
	formatEventDate,
	toEventFormData,
} from "@/components/event-ui";
import { Button, Card, Field } from "@/components/ui/nalum";
import { eventsApi } from "@/lib/api";

export default function AdminEventDetail() {
	const { eventId } = useLocalSearchParams<{ eventId: string }>();
	const client = useQueryClient();
	const [note, setNote] = useState("");
	const [reason, setReason] = useState("");
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const query = useQuery({
		queryKey: ["event", eventId],
		queryFn: () => eventsApi.get(eventId),
	});
	const refresh = async () => {
		await client.invalidateQueries({ queryKey: ["event", eventId] });
		await client.invalidateQueries({ queryKey: ["admin-events"] });
	};
	const approve = useMutation({
		mutationFn: () => eventsApi.approve(eventId, note),
		onSuccess: refresh,
	});
	const reject = useMutation({
		mutationFn: () => eventsApi.reject(eventId, reason),
		onSuccess: refresh,
	});
	const cancel = useMutation({
		mutationFn: () => eventsApi.cancel(eventId),
		onSuccess: refresh,
	});
	const remove = useMutation({
		mutationFn: () => eventsApi.remove(eventId),
		onSuccess: () => {
			void client.invalidateQueries({ queryKey: ["admin-events"] });
			router.replace("/admin");
		},
	});
	const attendees = useQuery({
		queryKey: ["event-attendees", eventId],
		queryFn: () => eventsApi.attendees(eventId, { limit: 100, offset: 0 }),
		enabled: Boolean(query.data),
	});
	if (query.isLoading)
		return (
			<AdminShell title="Event moderation">
				<Text className="p-6 text-muted">Loading event…</Text>
			</AdminShell>
		);
	if (query.error || !query.data)
		return (
			<AdminShell title="Event moderation">
				<View className="p-6">
					<Button variant="ghost" onPress={() => router.replace("/admin")}>
						← Back to administration
					</Button>
					<Text className="mt-4 text-muted">This event is unavailable.</Text>
				</View>
			</AdminShell>
		);
	const event = query.data;
	const save = async (value: Parameters<typeof toEventFormData>[0]) => {
		setSaving(true);
		setError("");
		try {
			await eventsApi.update(eventId, toEventFormData(value));
			setEditing(false);
			await refresh();
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not save event.",
			);
		} finally {
			setSaving(false);
		}
	};
	return (
		<AdminShell title="Event moderation">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
			>
				<Button variant="ghost" onPress={() => router.replace("/admin")}>
					← Back to administration
				</Button>
				<View className="mt-4 gap-4">
					<View className="flex-row items-start justify-between gap-3">
						<Text
							accessibilityRole="header"
							className="flex-1 text-3xl font-bold text-foreground"
						>
							{event.title}
						</Text>
						<EventStatusBadge status={event.status} />
					</View>
					<EventGallery event={event} />
					<Card>
						<View className="gap-2">
							<Text className="text-foreground">{event.description}</Text>
							<Text className="text-muted">
								{formatEventDate(event.startsAt)} –{" "}
								{formatEventDate(event.endsAt)}
							</Text>
							<Text className="text-muted">{event.venue}</Text>
							<Text className="text-muted">
								Created by {event.author.firstName} {event.author.lastName}
							</Text>
							<Text className="text-muted">{event.attendeeCount} RSVPs</Text>
						</View>
					</Card>
					{event.status === "PENDING" ? (
						<Card>
							<View className="gap-3">
								<Text className="text-lg font-semibold text-foreground">
									Moderate submission
								</Text>
								<Field
									label="Approval note (optional)"
									value={note}
									onChangeText={setNote}
									placeholder="Visible to the author"
								/>
								<Button
									loading={approve.isPending}
									onPress={() => approve.mutate()}
								>
									Approve and publish
								</Button>
								<Field
									label="Rejection reason"
									value={reason}
									onChangeText={setReason}
									placeholder="Required to reject"
								/>
								<Button
									variant="secondary"
									disabled={!reason.trim() || reject.isPending}
									onPress={() => reject.mutate()}
								>
									Reject submission
								</Button>
							</View>
						</Card>
					) : null}
					{event.rejectionReason ? (
						<Card>
							<Text className="font-semibold text-destructive">
								Rejection reason
							</Text>
							<Text className="mt-2 text-muted">{event.rejectionReason}</Text>
						</Card>
					) : null}
					{editing ? (
						<Card>
							<Text className="mb-4 text-lg font-semibold text-foreground">
								Edit event
							</Text>
							{error ? (
								<Text className="mb-3 text-destructive">{error}</Text>
							) : null}
							<EventForm
								event={event}
								saving={saving}
								submitLabel="Save event"
								onSubmit={save}
							/>
							<Button
								variant="ghost"
								disabled={saving}
								onPress={() => setEditing(false)}
							>
								Cancel editing
							</Button>
						</Card>
					) : (
						<View className="gap-3">
							<Button variant="secondary" onPress={() => setEditing(true)}>
								Edit event
							</Button>
							{event.status === "PENDING" || event.status === "PUBLISHED" ? (
								<Button
									variant="secondary"
									loading={cancel.isPending}
									onPress={() =>
										Alert.alert("Cancel event?", "New RSVPs will be blocked.", [
											{ text: "Keep event", style: "cancel" },
											{
												text: "Cancel event",
												style: "destructive",
												onPress: () => cancel.mutate(),
											},
										])
									}
								>
									Cancel event
								</Button>
							) : null}
							<Button
								variant="ghost"
								loading={remove.isPending}
								onPress={() =>
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
									)
								}
							>
								Delete event
							</Button>
						</View>
					)}
					<Card>
						<Text className="mb-3 text-lg font-semibold text-foreground">
							Attendees
						</Text>
						{attendees.isLoading ? (
							<Text className="text-muted">Loading attendees…</Text>
						) : attendees.data?.attendees.length ? (
							<View className="gap-3">
								{attendees.data.attendees.map((attendee) => (
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
				</View>
			</ScrollView>
		</AdminShell>
	);
}
