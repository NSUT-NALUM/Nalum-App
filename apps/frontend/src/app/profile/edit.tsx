import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	Alert,
	BackHandler,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Text,
	View,
} from "react-native";
import { Button, Card, Field, Screen } from "@/components/ui/nalum";
import { useTheme } from "@/hooks/use-theme";
import {
	apiImageSource,
	authApi,
	type Branch,
	type Campus,
	profileApi,
} from "@/lib/api";
import { getAuthRoute } from "@/lib/auth-navigation";
import { appendPickedImage } from "@/lib/image-upload";
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

export default function ProfileEditor() {
	const user = useAuthStore((state) => state.user);
	const profile = user?.profile;
	const theme = useTheme();
	const [city, setCity] = useState(profile?.city ?? "");
	const [country, setCountry] = useState(profile?.country ?? "");
	const [company, setCompany] = useState(profile?.currentCompany ?? "");
	const [role, setRole] = useState(profile?.currentRole ?? "");
	const [rollNumber, setRollNumber] = useState(profile?.rollNumber ?? "");
	const [batch, setBatch] = useState(String(profile?.batch ?? ""));
	const [branch, setBranch] = useState<Branch>(profile?.branch ?? "CSE");
	const [campus, setCampus] = useState<Campus>(profile?.campus ?? "MAIN");
	const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? "");
	const [alternateEmail, setAlternateEmail] = useState(
		profile?.alternateEmail ?? "",
	);
	const [linkedin, setLinkedin] = useState(user?.socialMedia?.linkedin ?? "");
	const [github, setGithub] = useState(user?.socialMedia?.github ?? "");
	const [experienceCompany, setExperienceCompany] = useState(
		user?.experiences[0]?.company ?? "",
	);
	const [experienceRole, setExperienceRole] = useState(
		user?.experiences[0]?.role ?? "",
	);
	const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const dirty = Boolean(
		photo ||
			city !== (profile?.city ?? "") ||
			country !== (profile?.country ?? "") ||
			company !== (profile?.currentCompany ?? "") ||
			role !== (profile?.currentRole ?? "") ||
			rollNumber !== (profile?.rollNumber ?? "") ||
			batch !== String(profile?.batch ?? "") ||
			branch !== (profile?.branch ?? "CSE") ||
			campus !== (profile?.campus ?? "MAIN") ||
			phoneNumber !== (profile?.phoneNumber ?? "") ||
			alternateEmail !== (profile?.alternateEmail ?? "") ||
			linkedin !== (user?.socialMedia?.linkedin ?? "") ||
			github !== (user?.socialMedia?.github ?? "") ||
			experienceCompany !== (user?.experiences[0]?.company ?? "") ||
			experienceRole !== (user?.experiences[0]?.role ?? ""),
	);

	const leave = useCallback(() => {
		if (!user) return;
		const go = () => router.replace(getAuthRoute(user));
		if (!dirty) {
			go();
			return;
		}
		Alert.alert(
			"Discard changes?",
			"Your unsaved profile changes will be lost.",
			[
				{ text: "Keep editing", style: "cancel" },
				{ text: "Discard", style: "destructive", onPress: go },
			],
		);
	}, [dirty, user]);

	useEffect(() => {
		const subscription = BackHandler.addEventListener(
			"hardwareBackPress",
			() => {
				leave();
				return true;
			},
		);
		return () => subscription.remove();
	}, [leave]);

	if (!user) return null;

	const pick = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			quality: 0.8,
		});
		if (!result.canceled) setPhoto(result.assets[0]);
	};

	const save = async () => {
		if (user.role === "ALUMNI" && !/^(19|20|21)\d{2}$/.test(batch)) {
			setError("Enter a valid four-digit graduation batch.");
			return;
		}
		if (phoneNumber && !/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
			setError("Use an international phone number such as +919876543210.");
			return;
		}
		if (alternateEmail && !/^\S+@\S+\.\S+$/.test(alternateEmail)) {
			setError("Enter a valid alternate email address.");
			return;
		}
		if (Boolean(experienceCompany) !== Boolean(experienceRole)) {
			setError("Add both a company and role for current experience.");
			return;
		}
		setBusy(true);
		setError("");
		try {
			const form = new FormData();
			form.append("city", city.trim());
			form.append("country", country.trim());
			form.append("currentCompany", company.trim());
			form.append("currentRole", role.trim());
			if (user.role === "ALUMNI") {
				form.append("rollNumber", rollNumber.trim());
				form.append("batch", batch);
				form.append("branch", branch);
				form.append("campus", campus);
				if (phoneNumber) form.append("phoneNumber", phoneNumber);
				if (alternateEmail)
					form.append("alternateEmail", alternateEmail.trim());
			}
			form.append(
				"socialMedia",
				JSON.stringify({ linkedin: linkedin || null, github: github || null }),
			);
			form.append(
				"experiences",
				JSON.stringify(
					experienceCompany && experienceRole
						? [
								{
									company: experienceCompany,
									role: experienceRole,
									isCurrent: true,
								},
							]
						: [],
				),
			);
			if (photo) appendPickedImage(form, "profilePicture", photo);
			await profileApi.update(form);
			const nextUser = await authApi.refreshUser();
			useAuthStore.getState().setUser(nextUser);
			router.replace(getAuthRoute(nextUser));
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
					showsVerticalScrollIndicator={false}
				>
					<Text
						accessibilityRole="header"
						className="mb-2 text-3xl font-bold text-foreground"
					>
						Edit profile
					</Text>
					<Text className="mb-5 text-muted">
						Keep your directory details current.
					</Text>

					<View className="gap-4">
						<Card>
							<Text className="mb-4 text-lg font-semibold text-foreground">
								Identity
							</Text>
							<View className="items-start gap-3">
								<Image
									accessibilityLabel="Profile photo"
									source={
										photo?.uri ??
										(profile?.profilePicture
											? apiImageSource(profile.profilePicture)
											: undefined)
									}
									style={{
										height: 88,
										width: 88,
										borderRadius: 44,
										backgroundColor: theme.border,
									}}
								/>
								<Text className="text-xl font-semibold text-foreground">
									{user.firstName} {user.lastName}
								</Text>
								<Text className="text-muted">{user.email}</Text>
								<Button variant="secondary" onPress={pick}>
									Change photo
								</Button>
							</View>
						</Card>

						{user.role === "ALUMNI" ? (
							<Card>
								<Text className="mb-2 text-lg font-semibold text-foreground">
									Verification
								</Text>
								<Text className="mb-4 text-sm text-muted">
									Changing academic details submits your profile for a new
									review and pauses member access.
								</Text>
								<View className="gap-4">
									<Field
										label="University roll number"
										value={rollNumber}
										onChangeText={setRollNumber}
										placeholder="Your roll number"
										autoCapitalize="characters"
									/>
									<Field
										label="Graduation batch"
										value={batch}
										onChangeText={setBatch}
										placeholder="For example, 2018"
										keyboardType="number-pad"
										maxLength={4}
									/>
									<Text className="text-sm font-medium text-foreground">
										Branch
									</Text>
									<View
										accessibilityRole="radiogroup"
										className="flex-row flex-wrap gap-2"
									>
										{branches.map((value) => (
											<Button
												key={value}
												selected={branch === value}
												variant={branch === value ? "primary" : "secondary"}
												onPress={() => setBranch(value)}
											>
												{value}
											</Button>
										))}
									</View>
									<Text className="text-sm font-medium text-foreground">
										Campus
									</Text>
									<View
										accessibilityRole="radiogroup"
										className="flex-row flex-wrap gap-2"
									>
										{(["MAIN", "EAST", "WEST"] as Campus[]).map((value) => (
											<Button
												key={value}
												selected={campus === value}
												variant={campus === value ? "primary" : "secondary"}
												onPress={() => setCampus(value)}
											>
												{value}
											</Button>
										))}
									</View>
								</View>
							</Card>
						) : null}

						<Card>
							<Text className="mb-4 text-lg font-semibold text-foreground">
								Location & work
							</Text>
							<View className="gap-4">
								{user.role === "ALUMNI" ? (
									<>
										<Field
											label="Phone or WhatsApp"
											value={phoneNumber}
											onChangeText={setPhoneNumber}
											placeholder="+919876543210"
											helperText="Include your country code."
											keyboardType="phone-pad"
											autoComplete="tel"
										/>
										<Field
											label="Alternate email"
											value={alternateEmail}
											onChangeText={setAlternateEmail}
											placeholder="you@example.com"
											keyboardType="email-address"
											autoCapitalize="none"
											autoComplete="email"
										/>
									</>
								) : null}
								<Field
									label="Current city"
									value={city}
									onChangeText={setCity}
									placeholder="City"
								/>
								<Field
									label="Country"
									value={country}
									onChangeText={setCountry}
									placeholder="Country"
									autoComplete="country"
								/>
								<Field
									label="Current company"
									value={company}
									onChangeText={setCompany}
									placeholder="Company"
								/>
								<Field
									label="Current role"
									value={role}
									onChangeText={setRole}
									placeholder="Role"
								/>
							</View>
						</Card>

						<Card>
							<Text className="mb-4 text-lg font-semibold text-foreground">
								Social
							</Text>
							<View className="gap-4">
								<Field
									label="LinkedIn"
									value={linkedin}
									onChangeText={setLinkedin}
									placeholder="https://linkedin.com/in/…"
									keyboardType="url"
									autoCapitalize="none"
								/>
								<Field
									label="GitHub"
									value={github}
									onChangeText={setGithub}
									placeholder="https://github.com/…"
									keyboardType="url"
									autoCapitalize="none"
								/>
							</View>
						</Card>

						<Card>
							<Text className="mb-4 text-lg font-semibold text-foreground">
								Current experience
							</Text>
							<View className="gap-4">
								<Field
									label="Company"
									value={experienceCompany}
									onChangeText={setExperienceCompany}
									placeholder="Company"
								/>
								<Field
									label="Role"
									value={experienceRole}
									onChangeText={setExperienceRole}
									placeholder="Role"
								/>
							</View>
						</Card>

						{error ? (
							<Text
								accessibilityLiveRegion="assertive"
								className="text-sm text-destructive"
							>
								{error}
							</Text>
						) : null}
						<Button loading={busy} disabled={!dirty} onPress={save}>
							Save changes
						</Button>
						<Button variant="ghost" disabled={busy} onPress={leave}>
							Back
						</Button>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	);
}
