import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	Text,
	View,
} from "react-native";
import { AdminShell } from "@/components/admin-shell";
import { Button, Card, Field } from "@/components/ui/nalum";
import { useTheme } from "@/hooks/use-theme";
import {
	type AdminOverview,
	type AdminUser,
	type AlumniVerificationStatus,
	adminApi,
	type Event,
	type EventPage,
	type EventStatus,
	eventsApi,
} from "@/lib/api";

type Tab = "reviews" | "users" | "events";
type EventSection = EventStatus | "HISTORY";
type Row = AdminUser | Event;

export default function AdminPortal() {
	const theme = useTheme();
	const [overview, setOverview] = useState<AdminOverview | null>(null);
	const [reviews, setReviews] = useState<AdminUser[]>([]);
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [eventPages, setEventPages] = useState<
		Partial<Record<EventStatus, EventPage>>
	>({});
	const [tab, setTab] = useState<Tab>("reviews");
	const [search, setSearch] = useState("");
	const [reviewStatus, setReviewStatus] =
		useState<AlumniVerificationStatus>("PENDING");
	const [eventSection, setEventSection] = useState<EventSection>("PENDING");
	const [startsFrom, setStartsFrom] = useState("");
	const [startsTo, setStartsTo] = useState("");
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [nextOverview, reviewPage, userPage, ...eventResults] =
				await Promise.all([
					adminApi.overview(),
					adminApi.alumni({ q: search || undefined, status: reviewStatus }),
					adminApi.users({ q: search || undefined }),
					...(["PENDING", "PUBLISHED", "REJECTED", "CANCELLED"] as const).map(
						(status) =>
							eventsApi.adminList({
								q: search || undefined,
								status,
								startsFrom: startsFrom || undefined,
								startsTo: startsTo || undefined,
								limit: 100,
							}),
					),
				]);
			setOverview(nextOverview);
			setReviews(reviewPage.users);
			setUsers(userPage.users);
			setEventPages({
				PENDING: eventResults[0],
				PUBLISHED: eventResults[1],
				REJECTED: eventResults[2],
				CANCELLED: eventResults[3],
			});
		} finally {
			setLoading(false);
		}
	}, [reviewStatus, search, startsFrom, startsTo]);

	useEffect(() => {
		void load();
	}, [load]);
	const eventRows =
		eventSection === "HISTORY"
			? Object.values(eventPages)
					.flatMap((page) => page?.events ?? [])
					.sort(
						(first, second) =>
							new Date(second.createdAt).getTime() -
							new Date(first.createdAt).getTime(),
					)
			: (eventPages[eventSection]?.events ?? []);
	const rows: Row[] =
		tab === "reviews" ? reviews : tab === "users" ? users : eventRows;

	return (
		<AdminShell title="Administration">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
				refreshControl={
					<RefreshControl
						colors={[theme.primary]}
						tintColor={theme.primary}
						refreshing={loading}
						onRefresh={load}
					/>
				}
			>
				<View className="mb-6 flex-row flex-wrap gap-3">
					<Metric label="Total users" value={overview?.totalUsers} />
					<Metric label="Pending reviews" value={overview?.pendingReviews} />
					<Metric label="Active bans" value={overview?.activeBans} />
					<Metric
						label="Registered in 30 days"
						value={overview?.recentRegistrations}
					/>
				</View>
				<View className="mb-5 flex-row flex-wrap gap-2">
					<Button
						variant={tab === "reviews" ? "primary" : "secondary"}
						onPress={() => setTab("reviews")}
					>
						Alumni reviews
					</Button>
					<Button
						variant={tab === "users" ? "primary" : "secondary"}
						onPress={() => setTab("users")}
					>
						User management
					</Button>
					<Button
						variant={tab === "events" ? "primary" : "secondary"}
						onPress={() => setTab("events")}
					>
						Event moderation
					</Button>
					<Button
						variant="secondary"
						onPress={() => router.push("/admin/posts" as never)}
					>
						Post moderation
					</Button>
					<Button
						variant="secondary"
						onPress={() => router.push("/admin/opportunities" as never)}
					>
						Opportunity moderation
					</Button>
				</View>
				<Card>
					<View className="gap-4">
						<Field
							label="Search"
							value={search}
							onChangeText={setSearch}
							placeholder={
								tab === "reviews"
									? "Search name, email, or roll number"
									: tab === "events"
										? "Search title, venue, or description"
										: "Search name or email"
							}
						/>
						{tab === "reviews" ? (
							<StatusChoices
								values={["PENDING", "VERIFIED", "REJECTED"]}
								selected={reviewStatus}
								onSelect={setReviewStatus}
							/>
						) : null}
						{tab === "events" ? (
							<EventNavigation
								pages={eventPages}
								selected={eventSection}
								onSelect={setEventSection}
							/>
						) : null}
						{tab === "events" ? (
							<>
								<Field
									label="Starts from"
									value={startsFrom}
									onChangeText={setStartsFrom}
									placeholder="ISO date, for example 2026-08-01"
								/>
								<Field
									label="Starts to"
									value={startsTo}
									onChangeText={setStartsTo}
									placeholder="ISO date, for example 2026-08-31"
								/>
							</>
						) : null}
						<Button variant="secondary" onPress={load}>
							Apply filters
						</Button>
					</View>
				</Card>
				<View className="mt-5 gap-3">
					{loading && !overview ? (
						<ActivityIndicator color={theme.primary} />
					) : rows.length === 0 ? (
						<Card>
							<Text className="text-muted">No matching records.</Text>
						</Card>
					) : (
						rows.map((row) => <AdminRow key={row.id} tab={tab} row={row} />)
					)}
				</View>
			</ScrollView>
		</AdminShell>
	);
}

function StatusChoices<T extends string>({
	values,
	selected,
	onSelect,
}: {
	values: readonly T[];
	selected: T;
	onSelect: (value: T) => void;
}) {
	return (
		<View className="flex-row flex-wrap gap-2">
			{values.map((status) => (
				<Button
					key={status}
					variant={selected === status ? "primary" : "secondary"}
					onPress={() => onSelect(status)}
				>
					{status}
				</Button>
			))}
		</View>
	);
}

function EventNavigation({
	pages,
	selected,
	onSelect,
}: {
	pages: Partial<Record<EventStatus, EventPage>>;
	selected: EventSection;
	onSelect: (section: EventSection) => void;
}) {
	const items: Array<{
		section: EventSection;
		label: string;
		count: number;
	}> = [
		{
			section: "PENDING",
			label: "Pending review",
			count: pages.PENDING?.total ?? 0,
		},
		{
			section: "PUBLISHED",
			label: "Posted / published",
			count: pages.PUBLISHED?.total ?? 0,
		},
		{
			section: "REJECTED",
			label: "Rejected",
			count: pages.REJECTED?.total ?? 0,
		},
		{
			section: "CANCELLED",
			label: "Cancelled",
			count: pages.CANCELLED?.total ?? 0,
		},
		{
			section: "HISTORY",
			label: "All history",
			count: Object.values(pages).reduce(
				(total, page) => total + (page?.total ?? 0),
				0,
			),
		},
	];
	return (
		<View className="gap-2">
			<Text className="text-sm font-medium text-foreground">
				Event navigation
			</Text>
			<View className="flex-row flex-wrap gap-2">
				{items.map((item) => (
					<Button
						key={item.section}
						variant={selected === item.section ? "primary" : "secondary"}
						onPress={() => onSelect(item.section)}
					>
						{item.label} ({item.count})
					</Button>
				))}
			</View>
			<Text className="text-sm text-muted">
				Published events are the events posted to members. All history includes
				all created events.
			</Text>
		</View>
	);
}

function AdminRow({ tab, row }: { tab: Tab; row: Row }) {
	const event = tab === "events" ? (row as Event) : null;
	const user = tab === "events" ? null : (row as AdminUser);
	return (
		<Pressable
			onPress={() =>
				router.push(
					(tab === "events"
						? `/admin/events/${event!.id}`
						: tab === "reviews"
							? `/admin/review/${user!.id}`
							: `/admin/user/${user!.id}`) as never,
				)
			}
		>
			<Card>
				<View className="flex-row flex-wrap items-center justify-between gap-3">
					<View>
						<Text className="text-lg font-semibold text-foreground">
							{event ? event.title : `${user!.firstName} ${user!.lastName}`}
						</Text>
						<Text className="text-muted">
							{event
								? `${new Date(event.startsAt).toLocaleString()} · ${event.venue}`
								: user!.email}
						</Text>
						{tab === "reviews" ? (
							<Text className="mt-1 text-muted">
								{user!.profile?.rollNumber ?? "No roll number"} ·{" "}
								{user!.profile?.branch ?? "—"} {user!.profile?.batch ?? "—"}
							</Text>
						) : null}
					</View>
					<View className="rounded-full bg-secondary px-3 py-1">
						<Text className="font-medium text-foreground">
							{event
								? event.status
								: tab === "reviews"
									? (user!.verificationStatus ?? "UNSUBMITTED")
									: user!.bans?.length
										? "BANNED"
										: user!.role}
						</Text>
					</View>
				</View>
			</Card>
		</Pressable>
	);
}

function Metric({
	label,
	value,
}: {
	label: string;
	value: number | undefined;
}) {
	return (
		<View className="min-w-44 flex-1 rounded-xl border border-border bg-card p-5">
			<Text className="text-sm text-muted">{label}</Text>
			<Text className="mt-1 text-3xl font-bold text-foreground">
				{value ?? "—"}
			</Text>
		</View>
	);
}
