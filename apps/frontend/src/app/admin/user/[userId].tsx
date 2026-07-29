import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { AdminShell } from "@/components/admin-shell";
import { Button, Card, Field } from "@/components/ui/nalum";
import { type AdminUser, adminApi } from "@/lib/api";

export default function AdminUserDetail() {
	const { userId } = useLocalSearchParams<{ userId: string }>();
	const [user, setUser] = useState<AdminUser | null>(null);
	const [showBan, setShowBan] = useState(false);
	const [reason, setReason] = useState("");
	const [hours, setHours] = useState("");
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		setUser(await adminApi.user(userId));
	}, [userId]);

	useEffect(() => {
		void load();
	}, [load]);

	const ban = async () => {
		if (!reason.trim()) {
			Alert.alert("Reason required", "Enter a ban reason.");
			return;
		}
		const duration = hours.trim() ? Number(hours) : null;
		if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) {
			Alert.alert("Invalid duration", "Enter a positive number of hours.");
			return;
		}
		setSaving(true);
		try {
			await adminApi.ban(
				userId,
				reason.trim(),
				duration
					? new Date(Date.now() + duration * 60 * 60 * 1000).toISOString()
					: null,
			);
			setShowBan(false);
			setReason("");
			setHours("");
			await load();
		} catch (error) {
			Alert.alert(
				"Ban not saved",
				error instanceof Error ? error.message : "Try again.",
			);
		} finally {
			setSaving(false);
		}
	};

	const unban = async () => {
		setSaving(true);
		try {
			await adminApi.unban(userId);
			await load();
		} finally {
			setSaving(false);
		}
	};

	const activeBan = user?.bans?.find(
		(item) =>
			!item.revokedAt &&
			(!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()),
	);

	return (
		<AdminShell title="User management">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
			>
				<View className="mb-4 items-start">
					<Button variant="ghost" onPress={() => router.replace("/admin")}>
						← Back to users
					</Button>
				</View>
				{!user ? (
					<ActivityIndicator color="#7a1f35" />
				) : (
					<View className="gap-4">
						<Card>
							<Text className="text-2xl font-bold text-foreground">
								{user.firstName} {user.lastName}
							</Text>
							<Text className="mt-1 text-muted">{user.email}</Text>
							<Text className="mt-4 text-foreground">Role: {user.role}</Text>
							<Text className="text-foreground">
								Email verified: {user.emailVerified ? "Yes" : "No"}
							</Text>
							<Text className="text-foreground">
								Alumni status: {user.verificationStatus ?? "Not applicable"}
							</Text>
							<Text className="text-foreground">
								Registered: {new Date(user.createdAt).toLocaleString()}
							</Text>
						</Card>

						<Card>
							<Text className="mb-3 text-lg font-semibold text-foreground">
								Account access
							</Text>
							{activeBan ? (
								<View className="gap-2">
									<Text className="font-semibold text-red-700">
										Active {activeBan.expiresAt ? "temporary" : "permanent"} ban
									</Text>
									<Text className="text-muted">{activeBan.reason}</Text>
									<Text className="text-muted">
										Expires:{" "}
										{activeBan.expiresAt
											? new Date(activeBan.expiresAt).toLocaleString()
											: "Never"}
									</Text>
									<Button disabled={saving} onPress={unban}>
										Unban user
									</Button>
								</View>
							) : user.role === "ADMIN" ? (
								<Text className="text-muted">
									Administrator accounts are protected from bans.
								</Text>
							) : showBan ? (
								<View className="gap-3 rounded-lg bg-secondary p-4">
									<Text className="font-semibold text-foreground">
										Confirm account ban
									</Text>
									<Field
										value={reason}
										onChangeText={setReason}
										placeholder="Required reason"
									/>
									<Field
										value={hours}
										onChangeText={setHours}
										placeholder="Hours (leave blank for permanent)"
										keyboardType="numeric"
									/>
									<View className="flex-row gap-2">
										<Button disabled={saving} onPress={ban}>
											Confirm ban
										</Button>
										<Button variant="ghost" onPress={() => setShowBan(false)}>
											Cancel
										</Button>
									</View>
								</View>
							) : (
								<Button onPress={() => setShowBan(true)}>Ban user</Button>
							)}
						</Card>

						{user.bans?.length ? (
							<Card>
								<Text className="mb-3 text-lg font-semibold text-foreground">
									Ban history
								</Text>
								{user.bans.map((banRecord) => (
									<View
										key={banRecord.id}
										className="mb-3 border-b border-border pb-3"
									>
										<Text className="font-medium text-foreground">
											{banRecord.reason}
										</Text>
										<Text className="text-sm text-muted">
											{new Date(banRecord.startsAt).toLocaleString()} ·{" "}
											{banRecord.revokedAt
												? `revoked ${new Date(
														banRecord.revokedAt,
													).toLocaleString()}`
												: banRecord.expiresAt
													? `expires ${new Date(
															banRecord.expiresAt,
														).toLocaleString()}`
													: "permanent"}
										</Text>
									</View>
								))}
							</Card>
						) : null}
					</View>
				)}
			</ScrollView>
		</AdminShell>
	);
}
