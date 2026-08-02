import { Link, router } from "expo-router";
import { useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Text,
	View,
} from "react-native";
import { Button, Card, Field, Screen } from "@/components/ui/nalum";
import { authApi, type Role } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function SignUp() {
	const [firstName, setFirst] = useState("");
	const [lastName, setLast] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [role, setRole] = useState<Role>("STUDENT");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const emailError =
		email && !/^\S+@\S+\.\S+$/.test(email.trim())
			? "Enter a valid email address."
			: "";
	const passwordError =
		password && password.length < 6 ? "Use at least 6 characters." : "";

	const submit = async () => {
		if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
			setError("Complete all fields to create your account.");
			return;
		}
		if (emailError || passwordError) return;
		setBusy(true);
		setError("");
		try {
			const user = await authApi.register({
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				email: email.trim(),
				password,
				role,
			});
			useAuthStore.getState().setUser(user);
			router.replace("/verify");
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
					contentContainerStyle={{ paddingBottom: 24 }}
					keyboardShouldPersistTaps="handled"
				>
					<Text
						accessibilityRole="header"
						className="mb-2 text-3xl font-bold text-foreground"
					>
						Join Nalum
					</Text>
					<Text className="mb-6 text-muted">
						Build your place in the NSUT network.
					</Text>
					<Card>
						<View className="gap-4">
							<Field
								label="First name"
								value={firstName}
								onChangeText={setFirst}
								placeholder="First name"
								autoComplete="given-name"
								textContentType="givenName"
							/>
							<Field
								label="Last name"
								value={lastName}
								onChangeText={setLast}
								placeholder="Last name"
								autoComplete="family-name"
								textContentType="familyName"
							/>
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
								placeholder="At least 6 characters"
								error={passwordError}
								helperText="Use 6 or more characters."
								secureTextEntry
								autoComplete="new-password"
								textContentType="newPassword"
							/>
							<View className="gap-2">
								<Text className="text-sm font-medium text-foreground">
									I am an
								</Text>
								<View accessibilityRole="radiogroup" className="flex-row gap-2">
									<Button
										selected={role === "STUDENT"}
										variant={role === "STUDENT" ? "primary" : "secondary"}
										onPress={() => setRole("STUDENT")}
									>
										Student
									</Button>
									<Button
										selected={role === "ALUMNI"}
										variant={role === "ALUMNI" ? "primary" : "secondary"}
										onPress={() => setRole("ALUMNI")}
									>
										Alumni
									</Button>
								</View>
							</View>
							{error ? (
								<Text
									accessibilityLiveRegion="assertive"
									className="text-sm text-destructive"
								>
									{error}
								</Text>
							) : null}
							<Button loading={busy} onPress={submit}>
								Create account
							</Button>
						</View>
					</Card>
					<Text className="mt-6 text-center text-muted">
						Already have an account?{" "}
						<Link href="/sign-in" className="font-semibold text-maroon">
							Sign in
						</Link>
					</Text>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	);
}
