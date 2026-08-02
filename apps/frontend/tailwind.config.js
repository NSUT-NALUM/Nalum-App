/** @type {import('tailwindcss').Config} */
module.exports = {
	// NOTE: Update this to include the paths to all files that contain Nativewind classes.
	content: ["./src/**/*.{js,jsx,ts,tsx}"],
	presets: [require("nativewind/preset")],
	theme: {
		extend: {
			colors: {
				background: "rgb(var(--background) / <alpha-value>)",
				foreground: "rgb(var(--foreground) / <alpha-value>)",
				card: "rgb(var(--surface) / <alpha-value>)",
				"card-foreground": "rgb(var(--foreground) / <alpha-value>)",
				border: "rgb(var(--border) / <alpha-value>)",
				input: "rgb(var(--border) / <alpha-value>)",
				primary: "rgb(var(--primary) / <alpha-value>)",
				"primary-foreground": "#FFFFFF",
				maroon: "rgb(var(--primary) / <alpha-value>)",
				muted: "rgb(var(--muted) / <alpha-value>)",
				"muted-foreground": "rgb(var(--muted) / <alpha-value>)",
				accent: "rgb(var(--border) / <alpha-value>)",
				"accent-foreground": "rgb(var(--foreground) / <alpha-value>)",
				secondary: "rgb(var(--border) / <alpha-value>)",
				"secondary-foreground": "rgb(var(--foreground) / <alpha-value>)",
				ring: "rgb(var(--primary) / <alpha-value>)",
				popover: "rgb(var(--surface) / <alpha-value>)",
				"popover-foreground": "rgb(var(--foreground) / <alpha-value>)",
				destructive: "#B42318",
			},
			borderRadius: { card: "12px" },
		},
	},
	plugins: [],
};
