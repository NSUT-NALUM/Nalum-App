import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { getAuthRoute } from "@/lib/auth-navigation";
import { useAuthStore } from "@/stores/auth-store";
export default function GoogleCallback() {
	const user = useAuthStore((state) => state.user);
	const theme = useTheme();

	useEffect(() => {
		router.replace(getAuthRoute(user));
	}, [user]);

	return (
		<View className="flex-1 items-center justify-center bg-background">
			<ActivityIndicator color={theme.primary} />
			<Text className="mt-4 text-muted">Completing Google sign-in…</Text>
		</View>
	);
}
