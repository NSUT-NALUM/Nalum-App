import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
	ScrollView,
	Text,
	View,
} from "react-native";
import { AdminShell } from "@/components/admin-shell";
import { Button, Card, Field } from "@/components/ui/nalum";
import { useTheme } from "@/hooks/use-theme";
import { type AdminUser, adminApi, branchLabel } from "@/lib/api";

type Action = "approve" | "reject" | "reopen" | null;

export default function ReviewDetail() {
	const theme = useTheme();
	const { userId } = useLocalSearchParams<{ userId: string }>();
	const [application, setApplication] = useState<AdminUser | null>(null);
	const [action, setAction] = useState<Action>(null);
	const [reason, setReason] = useState("");
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		setApplication(await adminApi.application(userId));
	}, [userId]);

	useEffect(() => {
		void load();
	}, [load]);

	const decide = async () => {
		if (!action || !application) return;
		if (action !== "approve" && !reason.trim()) {
			Alert.alert("Reason required", "Add a reason before confirming.");
			return;
		}
		setSaving(true);
		try {
			if (action === "approve")
				await adminApi.approve(application.id, reason.trim() || undefined);
			if (action === "reject")
				await adminApi.reject(application.id, reason.trim());
			if (action === "reopen")
				await adminApi.reopen(application.id, reason.trim());
			setAction(null);
			setReason("");
			await load();
		} catch (error) {
			Alert.alert(
				"Decision not saved",
				error instanceof Error ? error.message : "Try again.",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<AdminShell title="Alumni application">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
			>
				<View className="mb-4 items-start">
					<Button variant="ghost" onPress={() => router.replace("/admin")}>
						← Back to review queue
					</Button>
				</View>
				{!application ? (
					<ActivityIndicator color={theme.primary} />
				) : (
					<View className="gap-4">
						<Card>
							<Text className="text-2xl font-bold text-foreground">
								{application.firstName} {application.lastName}
							</Text>
							<Text className="mt-1 text-muted">{application.email}</Text>
							<Text className="mt-4 font-semibold text-foreground">
								Status: {application.verificationStatus ?? "UNSUBMITTED"}
							</Text>
							<Text className="mt-1 text-muted">
								Submitted:{" "}
								{application.verificationSubmittedAt
									? new Date(
											application.verificationSubmittedAt,
										).toLocaleString()
									: "—"}
							</Text>
						</Card>

						<Card>
							<Text className="mb-3 text-lg font-semibold text-foreground">
								Verification identity
							</Text>
							<Detail
								label="Roll number"
								value={application.profile?.rollNumber}
							/>
							<Detail
								label="Academic record"
								value={
									application.profile
										? `${branchLabel[application.profile.branch]} · ${application.profile.batch} · ${application.profile.campus}`
										: null
								}
							/>
							<Detail
								label="Location"
								value={[application.profile?.city, application.profile?.country]
									.filter(Boolean)
									.join(", ")}
							/>
							<Detail
								label="Current work"
								value={[
									application.profile?.currentRole,
									application.profile?.currentCompany,
								]
									.filter(Boolean)
									.join(" at ")}
							/>
							<View className="mt-3 flex-row flex-wrap gap-2">
								{application.profile?.phoneNumber ? (
									<Button
										variant="secondary"
										onPress={() =>
											Linking.openURL(
												`https://wa.me/${application.profile?.phoneNumber?.replace(/\D/g, "")}`,
											)
										}
									>
										WhatsApp
									</Button>
								) : null}
								{application.profile?.alternateEmail ? (
									<Button
										variant="secondary"
										onPress={() =>
											Linking.openURL(
												`mailto:${application.profile?.alternateEmail}`,
											)
										}
									>
										Alternate email
									</Button>
								) : null}
							</View>
						</Card>

						<Card>
							<Text className="mb-3 text-lg font-semibold text-foreground">
								Decision history
							</Text>
							{application.verificationEvents?.length ? (
								application.verificationEvents.map((event) => (
									<View
										key={event.id}
										className="mb-3 border-b border-border pb-3"
									>
										<Text className="font-semibold text-foreground">
											{event.type} → {event.newStatus}
										</Text>
										<Text className="text-sm text-muted">
											{new Date(event.createdAt).toLocaleString()}
											{event.actor
												? ` · ${[event.actor.firstName, event.actor.lastName].filter(Boolean).join(" ")}`
												: " · Applicant/system"}
										</Text>
										{event.reason ? (
											<Text className="mt-1 text-muted">{event.reason}</Text>
										) : null}
										<Text className="mt-1 text-xs text-muted">
											Notification: {event.notificationState}
										</Text>
									</View>
								))
							) : (
								<Text className="text-muted">No decision events yet.</Text>
							)}
						</Card>

						<Card>
							<Text className="mb-3 text-lg font-semibold text-foreground">
								Review action
							</Text>
							<View className="flex-row flex-wrap gap-2">
								{application.verificationStatus === "PENDING" ? (
									<>
										<Button onPress={() => setAction("approve")}>
											Approve
										</Button>
										<Button
											variant="secondary"
											onPress={() => setAction("reject")}
										>
											Reject
										</Button>
									</>
								) : (
									<Button
										variant="secondary"
										onPress={() => setAction("reopen")}
									>
										Reopen review
									</Button>
								)}
							</View>
							{action ? (
								<View className="mt-4 gap-3 rounded-lg bg-secondary p-4">
									<Text className="font-semibold text-foreground">
										Confirm {action}
									</Text>
									<Field
										label={action === "approve" ? "Approval note" : "Reason"}
										value={reason}
										onChangeText={setReason}
										placeholder={
											action === "approve"
												? "Optional approval note"
												: "Required reason"
										}
									/>
									<View className="flex-row gap-2">
										<Button disabled={saving} onPress={decide}>
											{saving ? "Saving…" : "Confirm decision"}
										</Button>
										<Button variant="ghost" onPress={() => setAction(null)}>
											Cancel
										</Button>
									</View>
								</View>
							) : null}
						</Card>
					</View>
				)}
			</ScrollView>
		</AdminShell>
	);
}

function Detail({
	label,
	value,
}: {
	label: string;
	value: string | null | undefined;
}) {
	return (
		<View className="mb-2">
			<Text className="text-xs font-semibold uppercase text-muted">
				{label}
			</Text>
			<Text className="text-foreground">{value || "—"}</Text>
		</View>
	);
}
