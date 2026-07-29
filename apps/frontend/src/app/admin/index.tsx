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
import {
	type AdminOverview,
	type AdminUser,
	type AlumniVerificationStatus,
	adminApi,
} from "@/lib/api";

type Tab = "reviews" | "users";

export default function AdminPortal() {
	const [overview, setOverview] = useState<AdminOverview | null>(null);
	const [reviews, setReviews] = useState<AdminUser[]>([]);
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [tab, setTab] = useState<Tab>("reviews");
	const [search, setSearch] = useState("");
	const [reviewStatus, setReviewStatus] =
		useState<AlumniVerificationStatus>("PENDING");
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [nextOverview, reviewPage, userPage] = await Promise.all([
				adminApi.overview(),
				adminApi.alumni({ q: search || undefined, status: reviewStatus }),
				adminApi.users({ q: search || undefined }),
			]);
			setOverview(nextOverview);
			setReviews(reviewPage.users);
			setUsers(userPage.users);
		} finally {
			setLoading(false);
		}
	}, [reviewStatus, search]);

	useEffect(() => {
		void load();
	}, [load]);

	return (
		<AdminShell title="Administration">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
				refreshControl={
					<RefreshControl refreshing={loading} onRefresh={load} />
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

				<View className="mb-5 flex-row gap-2">
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
				</View>

				<Card>
					<View className="gap-4">
						<Field
							value={search}
							onChangeText={setSearch}
							placeholder={
								tab === "reviews"
									? "Search name, email, or roll number"
									: "Search name or email"
							}
						/>
						{tab === "reviews" ? (
							<View className="flex-row flex-wrap gap-2">
								{(["PENDING", "VERIFIED", "REJECTED"] as const).map(
									(status) => (
										<Button
											key={status}
											variant={
												reviewStatus === status ? "primary" : "secondary"
											}
											onPress={() => setReviewStatus(status)}
										>
											{status}
										</Button>
									),
								)}
							</View>
						) : null}
						<Button variant="secondary" onPress={load}>
							Apply filters
						</Button>
					</View>
				</Card>

				<View className="mt-5 gap-3">
					{loading && !overview ? (
						<ActivityIndicator color="#7a1f35" />
					) : (tab === "reviews" ? reviews : users).length === 0 ? (
						<Card>
							<Text className="text-muted">No matching records.</Text>
						</Card>
					) : (
						(tab === "reviews" ? reviews : users).map((user) => (
							<Pressable
								key={user.id}
								onPress={() =>
									router.push(
										tab === "reviews"
											? `/admin/review/${user.id}`
											: `/admin/user/${user.id}`,
									)
								}
							>
								<Card>
									<View className="flex-row flex-wrap items-center justify-between gap-3">
										<View>
											<Text className="text-lg font-semibold text-foreground">
												{user.firstName} {user.lastName}
											</Text>
											<Text className="text-muted">{user.email}</Text>
											{tab === "reviews" ? (
												<Text className="mt-1 text-muted">
													{user.profile?.rollNumber ?? "No roll number"} ·{" "}
													{user.profile?.branch ?? "—"}{" "}
													{user.profile?.batch ?? "—"}
												</Text>
											) : null}
										</View>
										<View className="rounded-full bg-secondary px-3 py-1">
											<Text className="font-medium text-foreground">
												{tab === "reviews"
													? (user.verificationStatus ?? "UNSUBMITTED")
													: user.bans?.length
														? "BANNED"
														: user.role}
											</Text>
										</View>
									</View>
								</Card>
							</Pressable>
						))
					)}
				</View>
			</ScrollView>
		</AdminShell>
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
