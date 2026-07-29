import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Field, Screen } from "@/components/ui/nalum";
import { authApi, profileApi, type Branch, type Campus } from "@/lib/api";
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
	const submit = async () => {
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
			Alert.alert(
				"Unable to save profile",
				e instanceof Error ? e.message : "Try again.",
			);
		}
	};
	return (
		<Screen>
			<Text className="mb-2 text-3xl font-bold text-foreground">
				Complete your profile
			</Text>
			<Text className="mb-6 text-muted">
				A few details make the Nalum directory useful.
			</Text>
			<Card>
				<View className="gap-3">
					<Field
						value={batch}
						onChangeText={setBatch}
						placeholder="Graduation batch"
						keyboardType="numeric"
					/>
					{user?.role === "ALUMNI" ? (
						<Field
							value={rollNumber}
							onChangeText={setRollNumber}
							placeholder="University roll number"
						/>
					) : null}
					<Text className="font-medium text-foreground">Branch</Text>
					<View className="flex-row flex-wrap gap-2">
						{branches.map((x) => (
							<Button
								key={x}
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
								variant={campus === x ? "primary" : "secondary"}
								onPress={() => setCampus(x)}
							>
								{x}
							</Button>
						))}
					</View>
					<Button onPress={submit}>Finish profile</Button>
				</View>
			</Card>
		</Screen>
	);
}
