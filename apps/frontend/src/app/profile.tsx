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
import { authApi, type Branch, type Campus, profileApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const branches: Branch[] = [
	"CSE",
	"ECE",
	"MECH",
	"CIVIL",
	"CHEMICAL",
	"BIOTECH",
	"ELECTRICAL",
	"INSTRUMENTATION",
	"AEROSPACE",
	"MATERIALS",
	"INDUSTRIAL",
	"PRODUCTION",
];
export default function RequiredProfile() {
	const [batch, setBatch] = useState("2026");
	const [branch, setBranch] = useState<Branch>("CSE");
	const [campus, setCampus] = useState<Campus>("MAIN");
	const user = useAuthStore((state) => state.user);
	const [rollNumber, setRollNumber] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const submit = async () => {
		if (!/^(19|20|21)\d{2}$/.test(batch)) {
			setError("Enter a valid four-digit graduation year.");
			return;
		}
		if (user?.role === "ALUMNI" && !rollNumber.trim()) {
			setError("Enter your university roll number.");
			return;
		}
		setBusy(true);
		setError("");
		try {
			const profile = await profileApi.create({
				batch: Number(batch),
				branch,
				campus,
				...(user?.role === "ALUMNI" ? { rollNumber } : {}),
			});
			const u = await authApi.refreshUser();
			useAuthStore.getState().setUser({ ...u, profile });
			router.replace(
				user?.role === "ALUMNI" ? "/verification-pending" : "/directory",
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Try again.");
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
						Complete your profile
					</Text>
					<Text className="mb-6 text-muted">
						A few details make the Nalum directory useful.
					</Text>
					<Card>
						<View className="gap-4">
							<Field
								label="Graduation batch"
								value={batch}
								onChangeText={setBatch}
								placeholder="For example, 2026"
								keyboardType="number-pad"
								maxLength={4}
							/>
							{user?.role === "ALUMNI" ? (
								<Field
									label="University roll number"
									value={rollNumber}
									onChangeText={setRollNumber}
									placeholder="Your roll number"
									autoCapitalize="characters"
								/>
							) : null}
							<Text className="font-medium text-foreground">Branch</Text>
							<View className="flex-row flex-wrap gap-2">
								{branches.map((x) => (
									<Button
										key={x}
										selected={branch === x}
										variant={branch === x ? "primary" : "secondary"}
										onPress={() => setBranch(x)}
									>
										{x}
									</Button>
								))}
							</View>
							<Text className="font-medium text-foreground">Campus</Text>
							<View className="flex-row gap-2">
								{(["MAIN", "EAST", "WEST"] as Campus[]).map((x) => (
									<Button
										key={x}
										selected={campus === x}
										variant={campus === x ? "primary" : "secondary"}
										onPress={() => setCampus(x)}
									>
										{x}
									</Button>
								))}
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
								Finish profile
							</Button>
						</View>
					</Card>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	);
}
