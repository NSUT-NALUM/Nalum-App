import { Image } from "expo-image";
import { router } from "expo-router";
import { BadgeCheck } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, Card, Screen } from "@/components/ui/nalum";
import { useTheme } from "@/hooks/use-theme";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function Account() {
	const user = useAuthStore((state) => state.user);
	const [loggingOut, setLoggingOut] = useState(false);
	const theme = useTheme();
	if (!user) return null;
	const profile = user.profile;
	const initials =
		`${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

	const logout = async () => {
		setLoggingOut(true);
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
				contentContainerStyle={{ paddingBottom: 24 }}
				showsVerticalScrollIndicator={false}
			>
				<Text
					accessibilityRole="header"
					className="mb-5 text-3xl font-bold text-foreground"
				>
					Me
				</Text>
				<Card>
					<View className="items-center">
						<View className="size-24 items-center justify-center overflow-hidden rounded-full bg-border">
							{profile?.profilePicture ? (
								<Image
									accessibilityLabel="Your profile photo"
									source={profile.profilePicture}
									style={{ height: 96, width: 96 }}
								/>
							) : (
								<Text className="text-2xl font-semibold text-muted">
									{initials}
								</Text>
							)}
						</View>
						<View className="mt-4 flex-row items-center gap-2">
							<Text className="text-2xl font-semibold text-foreground">
								{user.firstName} {user.lastName}
							</Text>
							<BadgeCheck
								accessibilityLabel="Verified member"
								color={theme.primary}
								size={22}
							/>
						</View>
						<Text className="mt-1 text-muted">{user.email}</Text>
						<Text className="mt-2 rounded-full bg-border px-3 py-1 text-sm font-medium text-foreground">
							{user.role}
						</Text>
					</View>
				</Card>

				<View className="mt-4">
					<Card>
						<Text className="text-lg font-semibold text-foreground">
							Academic
						</Text>
						<Text className="mt-2 text-muted">
							{profile
								? `${profile.branch} · Class of ${profile.batch} · ${profile.campus} Campus`
								: "Academic details not added"}
						</Text>
						<Text className="mt-5 text-lg font-semibold text-foreground">
							Work
						</Text>
						<Text className="mt-2 text-muted">
							{[profile?.currentRole, profile?.currentCompany]
								.filter(Boolean)
								.join(" at ") || "Work details not added"}
						</Text>
					</Card>
				</View>

				<View className="mt-5 gap-3">
					<Button onPress={() => router.push("/profile/edit")}>
						Edit profile
					</Button>
					<Button variant="ghost" loading={loggingOut} onPress={logout}>
						Log out
					</Button>
				</View>
			</ScrollView>
		</Screen>
	);
}
