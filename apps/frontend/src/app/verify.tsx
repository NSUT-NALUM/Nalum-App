import { router } from "expo-router";
import { useState } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Text,
	View,
} from "react-native";
import { Button, Card, Field, Screen } from "@/components/ui/nalum";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function Verify() {
	const [otp, setOtp] = useState("");
	const [busy, setBusy] = useState<"send" | "verify" | null>(null);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const otpError = otp && !/^\d{6}$/.test(otp) ? "Enter the 6-digit code." : "";

	const send = async () => {
		setBusy("send");
		setError("");
		try {
			await authApi.sendOtp();
			setMessage("A new code was sent to your email.");
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Try again.");
		} finally {
			setBusy(null);
		}
	};
	const verify = async () => {
		if (otpError || !otp) {
			setError("Enter the 6-digit code.");
			return;
		}
		setBusy("verify");
		setError("");
		try {
			await authApi.verifyOtp(otp);
			const current = useAuthStore.getState().user;
			if (current) {
				useAuthStore.getState().setUser({ ...current, emailVerified: true });
			}
			router.replace("/profile");
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Try again.");
		} finally {
			setBusy(null);
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
					<Text
						accessibilityRole="header"
						className="mb-3 text-3xl font-bold text-foreground"
					>
						Verify your email
					</Text>
					<Text className="mb-6 text-muted">
						Enter the code sent to your email address.
					</Text>
					<Card>
						<View className="gap-4">
							<Field
								label="Verification code"
								value={otp}
								onChangeText={(value) =>
									setOtp(value.replace(/\D/g, "").slice(0, 6))
								}
								placeholder="6-digit code"
								error={otpError}
								autoComplete="one-time-code"
								keyboardType="number-pad"
								maxLength={6}
								textContentType="oneTimeCode"
								onSubmitEditing={verify}
							/>
							{error || message ? (
								<Text
									accessibilityLiveRegion="assertive"
									className={`text-sm ${error ? "text-destructive" : "text-muted"}`}
								>
									{error || message}
								</Text>
							) : null}
							<Button
								loading={busy === "verify"}
								disabled={Boolean(busy)}
								onPress={verify}
							>
								Verify email
							</Button>
							<Button
								variant="secondary"
								loading={busy === "send"}
								disabled={Boolean(busy)}
								onPress={send}
							>
								Send a new code
							</Button>
						</View>
					</Card>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	);
}
