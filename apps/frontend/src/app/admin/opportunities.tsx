import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { AdminShell } from "@/components/admin-shell";
import { Button, Card, Field } from "@/components/ui/nalum";
import { opportunitiesApi } from "@/lib/api";

export default function AdminOpportunities() {
	const client = useQueryClient();
	const [reason, setReason] = useState("");
	const opportunities = useQuery({
		queryKey: ["admin-opportunities", "PENDING"],
		queryFn: () =>
			opportunitiesApi.adminList({ status: "PENDING", limit: 100 }),
	});
	const refresh = () =>
		client.invalidateQueries({ queryKey: ["admin-opportunities"] });
	const approve = useMutation({
		mutationFn: (id: string) => opportunitiesApi.approve(id),
		onSuccess: refresh,
	});
	const reject = useMutation({
		mutationFn: (id: string) => opportunitiesApi.reject(id, reason.trim()),
		onSuccess: () => {
			setReason("");
			return refresh();
		},
	});

	return (
		<AdminShell title="Opportunity moderation">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
			>
				<Button variant="ghost" onPress={() => router.replace("/admin")}>
					← Back to administration
				</Button>
				<Text className="mb-4 mt-4 text-muted">
					Approve opportunities to make them visible to students and verified
					alumni.
				</Text>
				<Field
					label="Reason when rejecting"
					value={reason}
					onChangeText={setReason}
					placeholder="Required only for rejection"
					multiline
				/>
				<View className="mt-5 gap-3">
					{opportunities.isLoading ? (
						<Text className="text-muted">Loading…</Text>
					) : null}
					{!opportunities.isLoading &&
					!opportunities.data?.opportunities.length ? (
						<Card>
							<Text className="text-muted">
								No opportunities await approval.
							</Text>
						</Card>
					) : null}
					{opportunities.data?.opportunities.map((opportunity) => (
						<Card key={opportunity.id}>
							<View className="gap-3">
								<View>
									<Text className="text-lg font-semibold text-foreground">
										{opportunity.roleTitle}
									</Text>
									<Text className="mt-1 text-muted">
										{opportunity.organization} · {opportunity.type} ·{" "}
										{opportunity.workMode}
									</Text>
								</View>
								<Text className="text-foreground">
									{opportunity.description}
								</Text>
								<Text className="text-sm text-muted">
									{opportunity.location} · deadline {opportunity.deadline}
								</Text>
								<View className="flex-row flex-wrap gap-2">
									<Button
										loading={approve.isPending}
										onPress={() => approve.mutate(opportunity.id)}
									>
										Approve
									</Button>
									<Button
										variant="secondary"
										disabled={!reason.trim()}
										loading={reject.isPending}
										onPress={() => reject.mutate(opportunity.id)}
									>
										Reject
									</Button>
								</View>
							</View>
						</Card>
					))}
				</View>
			</ScrollView>
		</AdminShell>
	);
}
