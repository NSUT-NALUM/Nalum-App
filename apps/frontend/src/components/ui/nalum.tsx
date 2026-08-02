import { Eye, EyeOff } from "lucide-react-native";
import {
	Children,
	type PropsWithChildren,
	type ReactNode,
	useId,
	useState,
} from "react";
import {
	ActivityIndicator,
	Pressable,
	type TextInputProps,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button as ReusableButton } from "@/components/ui/button";
import { Card as ReusableCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/hooks/use-theme";
export function Button({
	children,
	onPress,
	variant = "primary",
	disabled,
	loading = false,
	accessibilityLabel,
	selected,
}: {
	children: ReactNode;
	onPress?: () => void;
	variant?: "primary" | "secondary" | "ghost";
	disabled?: boolean;
	loading?: boolean;
	accessibilityLabel?: string;
	selected?: boolean;
}) {
	const theme = useTheme();
	const reusableVariant =
		variant === "primary"
			? "default"
			: variant === "secondary"
				? "outline"
				: "ghost";

	return (
		<ReusableButton
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{
				busy: loading,
				disabled: disabled || loading,
				selected,
			}}
			className="h-12 rounded-xl active:opacity-80"
			disabled={disabled || loading}
			onPress={onPress}
			variant={reusableVariant}
		>
			{loading ? (
				<ActivityIndicator
					color={variant === "primary" ? "#FFFFFF" : theme.primary}
				/>
			) : null}
			{Children.map(children, (child) =>
				typeof child === "string" || typeof child === "number" ? (
					<Text>{child}</Text>
				) : (
					child
				),
			)}
		</ReusableButton>
	);
}
export function Field({
	label,
	helperText,
	error,
	...props
}: TextInputProps & {
	label: string;
	helperText?: string;
	error?: string;
}) {
	const id = useId();
	const [passwordVisible, setPasswordVisible] = useState(false);
	const theme = useTheme();
	return (
		<View className="gap-2">
			<Text
				nativeID={`${id}-label`}
				className="text-sm font-medium text-foreground"
			>
				{label}
			</Text>
			<View>
				<Input
					aria-labelledby={`${id}-label`}
					aria-invalid={Boolean(error)}
					accessibilityLabel={props.accessibilityLabel ?? label}
					accessibilityHint={error ?? helperText}
					className={`h-12 rounded-xl bg-card px-4 text-base ${props.secureTextEntry ? "pr-12" : ""} ${error ? "border-destructive" : ""}`}
					placeholderTextColor={theme.textSecondary}
					{...props}
					secureTextEntry={props.secureTextEntry && !passwordVisible}
				/>
				{props.secureTextEntry ? (
					<Pressable
						accessibilityLabel={
							passwordVisible ? "Hide password" : "Show password"
						}
						className="absolute right-0 size-12 items-center justify-center"
						onPress={() => setPasswordVisible((value) => !value)}
					>
						{passwordVisible ? (
							<EyeOff color={theme.textSecondary} size={20} />
						) : (
							<Eye color={theme.textSecondary} size={20} />
						)}
					</Pressable>
				) : null}
			</View>
			{error || helperText ? (
				<Text
					accessibilityLiveRegion={error ? "polite" : "none"}
					className={`text-sm ${error ? "text-destructive" : "text-muted"}`}
				>
					{error ?? helperText}
				</Text>
			) : null}
		</View>
	);
}
export function Card({ children }: PropsWithChildren) {
	return (
		<ReusableCard className="gap-0 rounded-card p-5">{children}</ReusableCard>
	);
}
export function Screen({ children }: PropsWithChildren) {
	return (
		<SafeAreaView className="flex-1 bg-background px-5 pb-4 pt-4">
			{children}
		</SafeAreaView>
	);
}
