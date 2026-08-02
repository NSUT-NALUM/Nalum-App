import { Link, router } from "expo-router";
import { useState } from "react";
import {
	KeyboardAvoidingView,
	Linking,
	Platform,
	ScrollView,
	Text,
	View,
} from "react-native";
import { Button, Card, Field, Screen } from "@/components/ui/nalum";
import { authApi } from "@/lib/api";
import { getAuthRoute } from "@/lib/auth-navigation";
import { useAuthStore } from "@/stores/auth-store";

export default function SignIn() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const emailError =
		email && !/^\S+@\S+\.\S+$/.test(email.trim())
			? "Enter a valid email address."
			: "";

	const submit = async () => {
		if (!email.trim() || !password || emailError) {
			setError("Enter your email and password to continue.");
			return;
		}
		setBusy(true);
		setError("");
		try {
			const user = await authApi.login(email.trim(), password);
			useAuthStore.getState().setUser(user);
			router.replace(getAuthRoute(user));
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Try again.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<Screen>
			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<ScrollView
					contentContainerStyle={{
						flexGrow: 1,
						justifyContent: "center",
						paddingBottom: 24,
					}}
					keyboardShouldPersistTaps="handled"
				>
					<View className="mb-10">
						<Text className="text-4xl font-bold text-foreground">Nalum</Text>
						<Text className="mt-2 text-lg text-muted">
							The NSUT alumni network.
						</Text>
					</View>
					<Card>
						<Text
							accessibilityRole="header"
							className="mb-5 text-2xl font-semibold text-foreground"
						>
							Welcome back
						</Text>
						<View className="gap-4">
							<Field
								label="Email address"
								value={email}
								onChangeText={setEmail}
								placeholder="you@example.com"
								error={emailError}
								autoCapitalize="none"
								autoComplete="email"
								keyboardType="email-address"
								textContentType="emailAddress"
							/>
							<Field
								label="Password"
								value={password}
								onChangeText={setPassword}
								placeholder="Your password"
								secureTextEntry
								autoComplete="current-password"
								textContentType="password"
								onSubmitEditing={submit}
							/>
							{error ? (
								<Text
									accessibilityLiveRegion="assertive"
									className="text-sm text-destructive"
								>
									{error}
								</Text>
							) : null}
							<Button loading={busy} onPress={submit}>
								Sign in
							</Button>
							<Button
								variant="secondary"
								disabled={busy}
								onPress={() => Linking.openURL(authApi.googleUrl)}
							>
								Continue with Google
							</Button>
						</View>
					</Card>
					<Text className="mt-6 text-center text-muted">
						New to Nalum?{" "}
						<Link href="/sign-up" className="font-semibold text-maroon">
							Create an account
						</Link>
					</Text>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	);
}
