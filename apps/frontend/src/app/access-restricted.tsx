import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Screen } from "@/components/ui/nalum";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function AccessRestrictedScreen() {
	const user = useAuthStore((state) => state.user);
	if (!user?.activeBan) return null;

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
			<Text className="mb-2 text-3xl font-bold text-foreground">
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
			<View className="mt-5">
				<Button variant="secondary" onPress={logout}>
					Log out
				</Button>
			</View>
		</Screen>
	);
}
