import { router } from "expo-router";
import type { PropsWithChildren } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export function AdminShell({
	children,
	title,
}: PropsWithChildren<{ title: string }>) {
	const { width } = useWindowDimensions();
	const wide = width >= 900;

	const logout = async () => {
		try {
			await authApi.logout();
		} finally {
			useAuthStore.getState().setUser(null);
			router.replace("/sign-in");
		}
	};

	const navigation = (
		<View
			className={
				wide
					? "w-64 gap-2 border-r border-border bg-card p-5"
					: "flex-row gap-2 border-b border-border bg-card px-4 py-3"
			}
		>
			{wide ? (
				<Text className="mb-6 text-2xl font-bold text-maroon">Nalum Admin</Text>
			) : null}
			<Pressable
				className="rounded-lg bg-maroon px-4 py-3"
				onPress={() => router.replace("/admin")}
			>
				<Text className="font-semibold text-white">Overview & management</Text>
			</Pressable>
			<Pressable className="rounded-lg px-4 py-3" onPress={logout}>
				<Text className="font-medium text-foreground">Log out</Text>
			</Pressable>
		</View>
	);

	return (
		<View
			className={
				wide ? "flex-1 flex-row bg-background" : "flex-1 bg-background"
			}
		>
			{navigation}
			<View className="min-w-0 flex-1">
				<View className="border-b border-border bg-background px-6 py-5">
					<Text className="text-2xl font-bold text-foreground">{title}</Text>
				</View>
				{children}
			</View>
		</View>
	);
}
