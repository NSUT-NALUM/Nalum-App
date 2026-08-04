import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MapPin } from "lucide-react-native";
import { Linking, ScrollView, Text, View } from "react-native";
import { Button, Card, Screen } from "@/components/ui/nalum";
import { opportunitiesApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function Opportunities() {
	const user = useAuthStore((state) => state.user);
	const canBrowse =
		user?.role === "STUDENT" ||
		(user?.role === "ALUMNI" && user.verificationStatus === "VERIFIED");
	const query = useQuery({
		queryKey: ["opportunities"],
		queryFn: () => opportunitiesApi.list({ limit: 50, offset: 0 }),
		enabled: canBrowse,
	});
	return (
		<Screen>
			<ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
				<Text
					accessibilityRole="header"
					className="text-3xl font-bold text-foreground"
				>
					Opportunities
				</Text>
				<Text className="mb-5 mt-1 text-muted">
					Internships and jobs shared with the Nalum community.
				</Text>
				{query.isLoading ? (
					<Text className="text-muted">Loading opportunities…</Text>
				) : query.error ? (
					<View className="items-center gap-3 py-8">
						<Text className="text-muted">Could not load opportunities.</Text>
						<Button variant="secondary" onPress={() => query.refetch()}>
							Try again
						</Button>
					</View>
				) : query.data?.opportunities.length ? (
					<View className="gap-3">
						{query.data.opportunities.map((opportunity) => (
							<Card key={opportunity.id}>
								<View className="gap-3">
									<View>
										<Text className="text-lg font-semibold text-foreground">
											{opportunity.roleTitle}
										</Text>
										<Text className="mt-1 text-muted">
											{opportunity.organization} ·{" "}
											{opportunity.type.toLowerCase()}
										</Text>
									</View>
									<Text className="text-foreground">
										{opportunity.description}
									</Text>
									<View className="flex-row items-center gap-2">
										<MapPin size={16} />
										<Text className="text-sm text-muted">
											{opportunity.workMode.toLowerCase()} ·{" "}
											{opportunity.location}
										</Text>
									</View>
									<Text className="text-sm text-muted">
										Apply by {opportunity.deadline}
									</Text>
									<Button
										variant="secondary"
										onPress={() => Linking.openURL(opportunity.applicationUrl)}
									>
										<ExternalLink size={18} /> Apply externally
									</Button>
								</View>
							</Card>
						))}
					</View>
				) : (
					<Card>
						<Text className="text-muted">No open opportunities right now.</Text>
					</Card>
				)}
			</ScrollView>
		</Screen>
	);
}
