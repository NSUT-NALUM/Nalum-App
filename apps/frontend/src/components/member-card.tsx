import { Image } from "expo-image";
import { BadgeCheck } from "lucide-react-native";
import { Text, View } from "react-native";
import { Button, Card } from "@/components/ui/nalum";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/hooks/use-theme";
import { apiImageSource, type User } from "@/lib/api";

export function MemberCard({
	user,
	onConnect,
}: {
	user: User;
	onConnect?: () => void;
}) {
	const theme = useTheme();
	const profile = user.profile;
	const initials =
		`${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

	return (
		<Card>
			<View className="flex-row gap-4">
				<View className="size-14 items-center justify-center overflow-hidden rounded-full bg-border">
					{profile?.profilePicture ? (
						<Image
							accessibilityLabel={`${user.firstName} ${user.lastName}'s profile photo`}
							source={apiImageSource(profile.profilePicture)}
							style={{ height: 56, width: 56 }}
						/>
					) : (
						<Text className="font-semibold text-muted">{initials}</Text>
					)}
				</View>
				<View className="min-w-0 flex-1">
					<View className="flex-row items-center gap-2">
						<Text className="shrink text-lg font-semibold text-foreground">
							{user.firstName} {user.lastName}
						</Text>
						{user.role !== "ALUMNI" ||
						user.verificationStatus === "VERIFIED" ? (
							<BadgeCheck
								accessibilityLabel="Verified member"
								color={theme.primary}
								size={18}
							/>
						) : null}
					</View>
					<Text className="mt-1 text-muted">
						{profile?.currentRole ?? "NSUT community member"}
						{profile?.currentCompany ? ` · ${profile.currentCompany}` : ""}
					</Text>
					<Text className="mt-2 text-sm font-medium text-maroon">
						{profile
							? `${profile.batch} · ${profile.branch} · ${profile.campus}`
							: user.role}
					</Text>
					{profile?.city || profile?.country ? (
						<Text className="mt-1 text-sm text-muted">
							{[profile.city, profile.country].filter(Boolean).join(", ")}
						</Text>
					) : null}
				</View>
				{onConnect ? (
					<View className="mt-4">
						<Button variant="secondary" onPress={onConnect}>
							Connect
						</Button>
					</View>
				) : null}
			</View>
		</Card>
	);
}

export function MemberCardSkeleton() {
	return (
		<View className="mb-3 rounded-card border border-border bg-card p-5">
			<View className="flex-row gap-4">
				<Skeleton className="size-14 rounded-full" />
				<View className="flex-1 gap-3">
					<Skeleton className="h-5 w-2/3" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-1/2" />
				</View>
			</View>
		</View>
	);
}
