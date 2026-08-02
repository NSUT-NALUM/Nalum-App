import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Screen } from "@/components/ui/nalum";
import { authApi } from "@/lib/api";
import { getAuthRoute } from "@/lib/auth-navigation";
import { useAuthStore } from "@/stores/auth-store";

export default function AccessRestrictedScreen() {
	const user = useAuthStore((state) => state.user);
	const [refreshing, setRefreshing] = useState(false);
	const [feedback, setFeedback] = useState("");
	if (!user?.activeBan) return null;

	const refresh = async () => {
		setRefreshing(true);
		setFeedback("");
		try {
			const nextUser = await authApi.refreshUser();
			useAuthStore.getState().setUser(nextUser);
			const route = getAuthRoute(nextUser);
			if (route !== "/access-restricted") router.replace(route);
			else setFeedback("This restriction is still active.");
		} catch (reason) {
			setFeedback(reason instanceof Error ? reason.message : "Try again.");
		} finally {
			setRefreshing(false);
		}
	};
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
			<View className="mb-3 self-start rounded-full bg-border px-3 py-1">
				<Text className="text-sm font-semibold text-foreground">
					ACCESS PAUSED
				</Text>
			</View>
			<Text
				accessibilityRole="header"
				className="mb-2 text-3xl font-bold text-foreground"
			>
				Account access restricted
			</Text>
			<Text className="mb-6 text-muted">
				Your account cannot use Nalum while this administrative restriction is
				active.
			</Text>
			<Card>
				<Text className="font-semibold text-foreground">Reason</Text>
				<Text className="mt-1 text-muted">{user.activeBan.reason}</Text>
				<Text className="mt-4 font-semibold text-foreground">Expires</Text>
				<Text className="mt-1 text-muted">
					{user.activeBan.expiresAt
						? new Date(user.activeBan.expiresAt).toLocaleString()
						: "This restriction is permanent."}
				</Text>
			</Card>
			<View className="mt-5 gap-3">
				<Button loading={refreshing} onPress={refresh}>
					Check access again
				</Button>
				{feedback ? (
					<Text
						accessibilityLiveRegion="polite"
						className="text-center text-sm text-muted"
					>
						{feedback}
					</Text>
				) : null}
				<Button variant="ghost" disabled={refreshing} onPress={logout}>
					Log out
				</Button>
			</View>
		</Screen>
	);
}
