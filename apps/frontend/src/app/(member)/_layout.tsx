import { Tabs } from "expo-router";
import {
	BriefcaseBusiness,
	CalendarDays,
	MessageCircle,
	MessageSquare,
	UserRound,
	UsersRound,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatEventBridge, ChatSocketProvider } from "@/hooks/use-chat-socket";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/auth-store";

export default function MemberTabs() {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const user = useAuthStore((state) => state.user);

	return (
		<ChatSocketProvider>
			<ChatEventBridge />
			<Tabs
				screenOptions={{
					headerShown: false,
					tabBarActiveTintColor: theme.primary,
					tabBarInactiveTintColor: theme.textSecondary,
					tabBarStyle: {
						backgroundColor: theme.surface,
						borderTopColor: theme.border,
						height: 56 + insets.bottom,
						paddingBottom: Math.max(insets.bottom, 8),
						paddingTop: 8,
					},
					tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
				}}
			>
				<Tabs.Screen
					name="posts"
					options={{
						title: "Posts",
						tabBarAccessibilityLabel: "Posts tab",
						tabBarIcon: ({ color, size }) => (
							<MessageSquare color={color} size={size} />
						),
					}}
				/>
				<Tabs.Screen
					name="directory"
					options={{
						title: "Directory",
						tabBarAccessibilityLabel: "Directory tab",
						tabBarIcon: ({ color, size }) => (
							<UsersRound color={color} size={size} />
						),
					}}
				/>
				<Tabs.Screen
					name="chats"
					options={{
						title: "Chats",
						tabBarAccessibilityLabel: "Chats tab",
						tabBarIcon: ({ color, size }) => (
							<MessageCircle color={color} size={size} />
						),
					}}
				/>
				<Tabs.Screen
					name="events"
					options={{
						title: "Events",
						tabBarAccessibilityLabel: "Events tab",
						tabBarIcon: ({ color, size }) => (
							<CalendarDays color={color} size={size} />
						),
					}}
				/>
				<Tabs.Protected guard={user?.role !== "PROFESSOR"}>
					<Tabs.Screen
						name="explore"
						options={{
							title: "Opportunities",
							tabBarAccessibilityLabel: "Opportunities tab",
							tabBarIcon: ({ color, size }) => (
								<BriefcaseBusiness color={color} size={size} />
							),
						}}
					/>
				</Tabs.Protected>
				<Tabs.Screen name="chat/[conversationId]" options={{ href: null }} />
				<Tabs.Screen
					name="account"
					options={{
						title: "Me",
						tabBarAccessibilityLabel: "Me tab",
						tabBarIcon: ({ color, size }) => (
							<UserRound color={color} size={size} />
						),
					}}
				/>
			</Tabs>
		</ChatSocketProvider>
	);
}
