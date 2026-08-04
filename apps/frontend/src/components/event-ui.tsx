import DateTimePicker from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { CalendarDays, MapPin, UsersRound } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, Field } from "@/components/ui/nalum";
import { useTheme } from "@/hooks/use-theme";
import { apiImageSource, type Event, type EventStatus } from "@/lib/api";
import { appendPickedImage } from "@/lib/image-upload";

export const formatEventDate = (value: string | Date) =>
	new Date(value).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});

export const canCreateEvents = (user: {
	role: string;
	verificationStatus: string | null;
}) =>
	user.role === "ADMIN" ||
	user.role === "PROFESSOR" ||
	(user.role === "ALUMNI" && user.verificationStatus === "VERIFIED");

export function EventStatusBadge({ status }: { status: EventStatus }) {
	const label = status[0] + status.slice(1).toLowerCase();
	return (
		<View
			className={`self-start rounded-full px-3 py-1 ${status === "PUBLISHED" ? "bg-primary" : status === "REJECTED" ? "bg-destructive" : "bg-secondary"}`}
		>
			<Text
				className={`text-xs font-semibold ${status === "PUBLISHED" || status === "REJECTED" ? "text-primary-foreground" : "text-foreground"}`}
			>
				{label}
			</Text>
		</View>
	);
}

export function EventCard({
	event,
	onPress,
}: {
	event: Event;
	onPress: () => void;
}) {
	const theme = useTheme();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`View ${event.title}`}
			onPress={onPress}
		>
			<Card>
				<View className="gap-3">
					{event.images[0] ? (
						<Image
							accessibilityLabel={`${event.title} image`}
							contentFit="cover"
							source={apiImageSource(event.images[0])}
							style={{ height: 160, width: "100%", borderRadius: 12 }}
						/>
					) : null}
					<View className="flex-row items-start justify-between gap-3">
						<View className="flex-1">
							<Text className="text-lg font-semibold text-foreground">
								{event.title}
							</Text>
							<Text className="mt-1 text-sm text-muted" numberOfLines={2}>
								{event.description}
							</Text>
						</View>
						<EventStatusBadge status={event.status} />
					</View>
					<View className="gap-1">
						<View className="flex-row items-center gap-2">
							<CalendarDays color={theme.textSecondary} size={16} />
							<Text className="text-sm text-muted">
								{formatEventDate(event.startsAt)}
							</Text>
						</View>
						<View className="flex-row items-center gap-2">
							<MapPin color={theme.textSecondary} size={16} />
							<Text className="text-sm text-muted">{event.venue}</Text>
						</View>
						<View className="flex-row items-center gap-2">
							<UsersRound color={theme.textSecondary} size={16} />
							<Text className="text-sm text-muted">
								{event.attendeeCount} going
							</Text>
						</View>
					</View>
				</View>
			</Card>
		</Pressable>
	);
}

export function EventGallery({ event }: { event: Event }) {
	if (!event.images.length) return null;
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={{ gap: 12 }}
		>
			{event.images.map((image, index) => (
				<Image
					key={image}
					accessibilityLabel={`${event.title} image ${index + 1}`}
					contentFit="cover"
					source={apiImageSource(image)}
					style={{ height: 220, width: 300, borderRadius: 12 }}
				/>
			))}
		</ScrollView>
	);
}

export type EventFormValue = {
	title: string;
	description: string;
	venue: string;
	meetUrl: string;
	startsAt: Date;
	endsAt: Date;
	images: ImagePicker.ImagePickerAsset[] | null;
};

export function toEventFormData(value: EventFormValue) {
	const form = new FormData();
	form.append("title", value.title.trim());
	form.append("description", value.description.trim());
	form.append("venue", value.venue.trim());
	form.append("startsAt", value.startsAt.toISOString());
	form.append("endsAt", value.endsAt.toISOString());
	form.append("meetUrl", value.meetUrl.trim());
	for (const image of value.images ?? []) {
		appendPickedImage(form, "images", image);
	}
	return form;
}

export function EventForm({
	event,
	onSubmit,
	saving,
	submitLabel,
}: {
	event?: Event;
	onSubmit: (value: EventFormValue) => Promise<void>;
	saving: boolean;
	submitLabel: string;
}) {
	const [title, setTitle] = useState(event?.title ?? "");
	const [description, setDescription] = useState(event?.description ?? "");
	const [venue, setVenue] = useState(event?.venue ?? "");
	const [meetUrl, setMeetUrl] = useState(event?.meetUrl ?? "");
	const [startsAt, setStartsAt] = useState(() =>
		event ? new Date(event.startsAt) : new Date(Date.now() + 60 * 60 * 1000),
	);
	const [endsAt, setEndsAt] = useState(() =>
		event ? new Date(event.endsAt) : new Date(Date.now() + 2 * 60 * 60 * 1000),
	);
	const [images, setImages] = useState<ImagePicker.ImagePickerAsset[] | null>(
		event ? null : [],
	);
	const [picker, setPicker] = useState<"startsAt" | "endsAt" | null>(null);
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
		if (!title.trim() || !description.trim() || !venue.trim()) {
			setError("Title, description, and venue are required.");
			return;
		}
		if (endsAt <= startsAt) {
			setError("End time must be after the start time.");
			return;
		}
		if (meetUrl && !/^https?:\/\//i.test(meetUrl.trim())) {
			setError("Meet URL must start with http:// or https://.");
			return;
		}
		setError("");
		await onSubmit({
			title,
			description,
			venue,
			meetUrl,
			startsAt,
			endsAt,
			images,
		});
	};

	const updateDate = (field: "startsAt" | "endsAt", value: Date) => {
		if (field === "startsAt") setStartsAt(value);
		else setEndsAt(value);
	};

	return (
		<View className="gap-4">
			<Field
				label="Title"
				value={title}
				onChangeText={setTitle}
				placeholder="Event title"
				maxLength={200}
			/>
			<Field
				label="Description"
				value={description}
				onChangeText={setDescription}
				placeholder="What should attendees know?"
				multiline
				numberOfLines={5}
				maxLength={10000}
			/>
			<Field
				label="Venue"
				value={venue}
				onChangeText={setVenue}
				placeholder="Campus venue or address"
				maxLength={500}
			/>
			<Field
				label="Meet URL (optional)"
				value={meetUrl}
				onChangeText={setMeetUrl}
				placeholder="https://…"
				keyboardType="url"
				autoCapitalize="none"
			/>
			<DateField
				label="Starts"
				value={startsAt}
				onChange={updateDate}
				setPicker={setPicker}
			/>
			<DateField
				label="Ends"
				value={endsAt}
				onChange={updateDate}
				setPicker={setPicker}
			/>
			{picker && Platform.OS !== "web" ? (
				<DateTimePicker
					value={picker === "startsAt" ? startsAt : endsAt}
					mode="datetime"
					onChange={(_event, value) => {
						setPicker(null);
						if (value) updateDate(picker, value);
					}}
				/>
			) : null}
			<Card>
				<View className="gap-3">
					<Text className="text-lg font-semibold text-foreground">Images</Text>
					<Text className="text-sm text-muted">
						Up to 10 images.{" "}
						{event
							? "Selecting images replaces the current gallery."
							: "Image order is preserved."}
					</Text>
					<Button variant="secondary" onPress={chooseImages}>
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
									source={image.uri}
									style={{ height: 88, width: 88, borderRadius: 10 }}
									contentFit="cover"
									accessibilityLabel={`Selected image ${index + 1}`}
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

function DateField({
	label,
	value,
	onChange,
	setPicker,
}: {
	label: string;
	value: Date;
	onChange: (field: "startsAt" | "endsAt", value: Date) => void;
	setPicker: (value: "startsAt" | "endsAt" | null) => void;
}) {
	const field = label === "Starts" ? "startsAt" : "endsAt";
	return Platform.OS === "web" ? (
		<Field
			label={label}
			value={value.toISOString().slice(0, 16)}
			onChangeText={(next) => {
				const parsed = new Date(next);
				if (!Number.isNaN(parsed.getTime())) onChange(field, parsed);
			}}
			placeholder="YYYY-MM-DDTHH:mm"
			helperText="Use your local date and time."
		/>
	) : (
		<View className="gap-2">
			<Text className="text-sm font-medium text-foreground">{label}</Text>
			<Button variant="secondary" onPress={() => setPicker(field)}>
				{formatEventDate(value)}
			</Button>
		</View>
	);
}
