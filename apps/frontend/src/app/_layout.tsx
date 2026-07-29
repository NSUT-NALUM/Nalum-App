import "../global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

function AppNavigator() {
	const { ready, setReady, setUser, user } = useAuthStore();

	useEffect(() => {
		authApi
			.restore()
			.then(setUser)
			.catch(() => setUser(null))
			.finally(setReady);
	}, [setReady, setUser]);

	if (!ready) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<ActivityIndicator color="#7a1f35" />
			</View>
		);
	}

	const signedIn = user !== null;
	const emailVerified = signedIn && user.emailVerified;
	const profileCompleted = emailVerified && user.profileCompleted;
	const isAdmin = user?.role === "ADMIN";
	const isBanned = Boolean(user?.activeBan);
	const isVerifiedAlumni =
		user?.role !== "ALUMNI" || user.verificationStatus === "VERIFIED";
	const isPendingAlumni =
		user?.role === "ALUMNI" &&
		user.verificationStatus !== "VERIFIED" &&
		user.verificationStatus !== "REJECTED";
	const isRejectedAlumni =
		user?.role === "ALUMNI" && user.verificationStatus === "REJECTED";

	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="index" />
			<Stack.Screen name="auth/callback" />

			<Stack.Protected guard={!signedIn}>
				<Stack.Screen name="sign-in" />
				<Stack.Screen name="sign-up" />
			</Stack.Protected>

			<Stack.Protected guard={signedIn && !emailVerified}>
				<Stack.Screen name="verify" />
			</Stack.Protected>

			<Stack.Protected guard={emailVerified && !isBanned && !profileCompleted}>
				<Stack.Screen name="profile" />
			</Stack.Protected>

			<Stack.Protected guard={Boolean(emailVerified && isBanned)}>
				<Stack.Screen name="access-restricted" />
			</Stack.Protected>

			<Stack.Protected guard={profileCompleted && !isBanned && isPendingAlumni}>
				<Stack.Screen name="verification-pending" />
			</Stack.Protected>

			<Stack.Protected
				guard={profileCompleted && !isBanned && isRejectedAlumni}
			>
				<Stack.Screen name="verification-rejected" />
			</Stack.Protected>

			<Stack.Protected
				guard={profileCompleted && !isBanned && isVerifiedAlumni && !isAdmin}
			>
				<Stack.Screen name="directory" />
				<Stack.Screen name="explore" />
			</Stack.Protected>

			<Stack.Protected
				guard={
					profileCompleted &&
					!isBanned &&
					!isAdmin &&
					(isPendingAlumni || isRejectedAlumni || isVerifiedAlumni)
				}
			>
				<Stack.Screen name="profile/edit" />
			</Stack.Protected>

			<Stack.Protected guard={Boolean(isAdmin && !isBanned)}>
				<Stack.Screen name="admin" />
				<Stack.Screen name="admin/review/[userId]" />
				<Stack.Screen name="admin/user/[userId]" />
			</Stack.Protected>
		</Stack>
	);
}

export default function RootLayout() {
	const [client] = useState(() => new QueryClient());
	return (
		<QueryClientProvider client={client}>
			<AppNavigator />
		</QueryClientProvider>
	);
}
