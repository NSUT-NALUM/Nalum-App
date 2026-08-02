import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { MemberCard, MemberCardSkeleton } from "@/components/member-card";
import { Button, Card, Field, Screen } from "@/components/ui/nalum";
import { useTheme } from "@/hooks/use-theme";
import { type Branch, type Campus, type Role, usersApi } from "@/lib/api";

type Filters = {
	role: "" | Role;
	branch: "" | Branch;
	campus: "" | Campus;
	batch: string;
	company: string;
	city: string;
	country: string;
};

const emptyFilters: Filters = {
	role: "",
	branch: "",
	campus: "",
	batch: "",
	company: "",
	city: "",
	country: "",
};
const roles: Role[] = ["STUDENT", "ALUMNI", "PROFESSOR"];
const campuses: Campus[] = ["MAIN", "EAST", "WEST"];
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

function ChoiceGroup<T extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: T[];
	value: "" | T;
	onChange: (value: "" | T) => void;
}) {
	return (
		<View className="gap-2">
			<Text className="text-sm font-medium text-foreground">{label}</Text>
			<View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
				{options.map((option) => (
					<Button
						key={option}
						accessibilityLabel={`${label}: ${option}`}
						selected={value === option}
						variant={value === option ? "primary" : "secondary"}
						onPress={() => onChange(value === option ? "" : option)}
					>
						{option}
					</Button>
				))}
			</View>
		</View>
	);
}

export default function Discover() {
	const [draft, setDraft] = useState<Filters>(emptyFilters);
	const [applied, setApplied] = useState<Filters>(emptyFilters);
	const [showFilters, setShowFilters] = useState(false);
	const theme = useTheme();
	const activeCount = Object.values(applied).filter(Boolean).length;
	const batchError =
		draft.batch &&
		(!/^\d{4}$/.test(draft.batch) ||
			Number(draft.batch) < 1900 ||
			Number(draft.batch) > 2100)
			? "Enter a year from 1900 to 2100."
			: "";
	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["discover", applied],
		queryFn: () =>
			usersApi({
				...applied,
				batch: applied.batch ? Number(applied.batch) : undefined,
				limit: 30,
				offset: 0,
			}),
	});
	const reset = () => {
		setDraft(emptyFilters);
		setApplied(emptyFilters);
	};

	return (
		<Screen>
			<ScrollView
				contentContainerStyle={{ paddingBottom: 24 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<View className="mb-5">
					<Text
						accessibilityRole="header"
						className="text-3xl font-bold text-foreground"
					>
						Discover
					</Text>
					<Text className="mt-1 text-muted">
						Explore the network by study, work, or place.
					</Text>
				</View>
				<Button
					variant="secondary"
					onPress={() => setShowFilters((value) => !value)}
				>
					<SlidersHorizontal color={theme.primary} size={18} />
					{showFilters
						? "Hide filters"
						: `Filters${activeCount ? ` (${activeCount})` : ""}`}
				</Button>

				{showFilters ? (
					<View className="mt-4">
						<Card>
							<View className="gap-4">
								<ChoiceGroup
									label="Member type"
									options={roles}
									value={draft.role}
									onChange={(role) => setDraft({ ...draft, role })}
								/>
								<ChoiceGroup
									label="Campus"
									options={campuses}
									value={draft.campus}
									onChange={(campus) => setDraft({ ...draft, campus })}
								/>
								<ChoiceGroup
									label="Branch"
									options={branches}
									value={draft.branch}
									onChange={(branch) => setDraft({ ...draft, branch })}
								/>
								<Field
									label="Graduation batch"
									placeholder="For example, 2018"
									keyboardType="number-pad"
									maxLength={4}
									error={batchError}
									value={draft.batch}
									onChangeText={(batch) =>
										setDraft({
											...draft,
											batch: batch.replace(/\D/g, "").slice(0, 4),
										})
									}
								/>
								<Field
									label="Company"
									placeholder="Company name"
									value={draft.company}
									onChangeText={(company) => setDraft({ ...draft, company })}
								/>
								<Field
									label="City"
									placeholder="City"
									value={draft.city}
									onChangeText={(city) => setDraft({ ...draft, city })}
								/>
								<Field
									label="Country"
									placeholder="Country"
									value={draft.country}
									onChangeText={(country) => setDraft({ ...draft, country })}
								/>
								<Button
									disabled={Boolean(batchError)}
									onPress={() => {
										setApplied({ ...draft });
										setShowFilters(false);
									}}
								>
									Apply filters
								</Button>
								<Button variant="ghost" onPress={reset}>
									Reset all
								</Button>
							</View>
						</Card>
					</View>
				) : null}

				<Text
					accessibilityLiveRegion="polite"
					className="mb-4 mt-5 text-sm text-muted"
				>
					{isLoading ? "Finding members…" : `${data?.total ?? 0} members found`}
				</Text>
				{isLoading ? (
					<>
						<MemberCardSkeleton />
						<MemberCardSkeleton />
					</>
				) : error ? (
					<View className="items-center gap-4 py-8">
						<Text className="text-center text-muted">
							Could not load these results.
						</Text>
						<Button variant="secondary" onPress={() => refetch()}>
							Try again
						</Button>
					</View>
				) : data?.users.length ? (
					<View className="gap-3">
						{data.users.map((user) => (
							<MemberCard key={user.id} user={user} />
						))}
					</View>
				) : (
					<View className="items-center gap-4 py-8">
						<Text className="text-center text-muted">
							No members match these filters.
						</Text>
						{activeCount ? (
							<Button variant="secondary" onPress={reset}>
								Reset filters
							</Button>
						) : null}
					</View>
				)}
			</ScrollView>
		</Screen>
	);
}
