/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { vars } from "nativewind";
import { Platform } from "react-native";

export const Colors = {
	light: {
		text: "#18181B",
		background: "#F7F7F8",
		surface: "#FFFFFF",
		border: "#E4E4E7",
		primary: "#7A1F35",
		backgroundElement: "#FFFFFF",
		backgroundSelected: "#E4E4E7",
		textSecondary: "#5F6268",
	},
	dark: {
		text: "#FAFAFA",
		background: "#111113",
		surface: "#1A1A1E",
		border: "#303036",
		primary: "#A53C57",
		backgroundElement: "#1A1A1E",
		backgroundSelected: "#303036",
		textSecondary: "#B0B0B8",
	},
} as const;

export const ThemeVariables = {
	light: vars({
		"--background": "247 247 248",
		"--surface": "255 255 255",
		"--foreground": "24 24 27",
		"--muted": "95 98 104",
		"--border": "228 228 231",
		"--primary": "122 31 53",
	}),
	dark: vars({
		"--background": "17 17 19",
		"--surface": "26 26 30",
		"--foreground": "250 250 250",
		"--muted": "176 176 184",
		"--border": "48 48 54",
		"--primary": "165 60 87",
	}),
};

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
	ios: {
		/** iOS `UIFontDescriptorSystemDesignDefault` */
		sans: "system-ui",
		/** iOS `UIFontDescriptorSystemDesignSerif` */
		serif: "ui-serif",
		/** iOS `UIFontDescriptorSystemDesignRounded` */
		rounded: "ui-rounded",
		/** iOS `UIFontDescriptorSystemDesignMonospaced` */
		mono: "ui-monospace",
	},
	default: {
		sans: "normal",
		serif: "serif",
		rounded: "normal",
		mono: "monospace",
	},
	web: {
		sans: "var(--font-display)",
		serif: "var(--font-serif)",
		rounded: "var(--font-rounded)",
		mono: "var(--font-mono)",
	},
});

export const Spacing = {
	half: 2,
	one: 4,
	two: 8,
	three: 16,
	four: 24,
	five: 32,
	six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
