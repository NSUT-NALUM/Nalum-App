import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, ScrollView, Text, View } from "react-native";
import { Button, Card, Screen } from "@/components/ui/nalum";
import { authApi, branchLabel } from "@/lib/api";
import { getAuthRoute } from "@/lib/auth-navigation";
import { useAuthStore } from "@/stores/auth-store";

export function VerificationStatus({ rejected }: { rejected: boolean }) {
	const user = useAuthStore((state) => state.user);
	const [refreshing, setRefreshing] = useState(false);
	const [feedback, setFeedback] = useState("");

	const refresh = useCallback(async (announce = false) => {
		setRefreshing(true);
		try {
			const nextUser = await authApi.refreshUser();
			useAuthStore.getState().setUser(nextUser);
			const nextRoute = getAuthRoute(nextUser);
			if (
				nextRoute !== "/verification-pending" &&
				nextRoute !== "/verification-rejected"
			) {
				router.replace(nextRoute);
			} else if (announce) {
				setFeedback(
					"Status is unchanged. We will keep checking automatically.",
				);
			}
		} catch {
			if (announce) setFeedback("Could not refresh status. Try again.");
		} finally {
			setRefreshing(false);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			void refresh(false);
			const interval = setInterval(() => void refresh(false), 30_000);
			return () => clearInterval(interval);
		}, [refresh]),
	);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") void refresh(false);
		});
		return () => subscription.remove();
	}, [refresh]);

	if (!user) return null;
	const profile = user.profile;

	const logout = async () => {
		try {
			await authApi.logout();
		} finally {
			useAuthStore.getState().setUser(null);
			router.replace("/sign-in");
		}
	};

	return (
		<Screen>
			<ScrollView
				contentContainerStyle={{ paddingBottom: 40 }}
				showsVerticalScrollIndicator={false}
			>
				<View className="mb-3 self-start rounded-full bg-border px-3 py-1">
					<Text className="text-sm font-semibold text-foreground">
						{rejected ? "ACTION REQUIRED" : "IN REVIEW"}
					</Text>
				</View>
				<Text
					accessibilityRole="header"
					className="mb-2 text-3xl font-bold text-foreground"
				>
					{rejected ? "Application needs an update" : "Verification in review"}
				</Text>
				<Text className="mb-6 text-muted">
					{rejected
						? "Your alumni access is paused. Correct your academic details to submit a new review."
						: "Nalum reviews alumni applications manually. You can safely return later; this page refreshes automatically."}
				</Text>

				{rejected ? (
					<Card>
						<Text className="mb-2 font-semibold text-foreground">
							Reviewer reason
						</Text>
						<Text className="text-muted">
							{user.latestReviewReason ?? "No reason was supplied."}
						</Text>
						<Text className="mt-3 text-sm text-muted">
							If you believe this decision is a mistake, contact the Nalum
							support team with your account email and roll number.
						</Text>
					</Card>
				) : null}

				<View className="mt-4">
					<Card>
						<Text className="mb-3 text-lg font-semibold text-foreground">
							Submitted details
						</Text>
						<Text className="mb-1 text-muted">
							Name: {user.firstName} {user.lastName}
						</Text>
						<Text className="mb-1 text-muted">Email: {user.email}</Text>
						<Text className="mb-1 text-muted">
							Roll number: {profile?.rollNumber ?? "—"}
						</Text>
						<Text className="mb-1 text-muted">
							Academic: {profile ? branchLabel[profile.branch] : "—"} ·{" "}
							{profile?.batch ?? "—"} · {profile?.campus ?? "—"}
						</Text>
						<Text className="text-muted">
							Submitted:{" "}
							{user.verificationSubmittedAt
								? new Date(user.verificationSubmittedAt).toLocaleString()
								: "—"}
						</Text>
					</Card>
				</View>

				<View className="mt-5 gap-3">
					<Button onPress={() => router.push("/profile/edit")}>
						Edit or correct application
					</Button>
					<Button
						variant="secondary"
						loading={refreshing}
						onPress={() => refresh(true)}
					>
						Refresh status
					</Button>
					{feedback ? (
						<Text
							accessibilityLiveRegion="polite"
							className="text-center text-sm text-muted"
						>
							{feedback}
						</Text>
					) : null}
					<Button variant="ghost" onPress={logout}>
						Log out
					</Button>
				</View>
			</ScrollView>
		</Screen>
	);
}
