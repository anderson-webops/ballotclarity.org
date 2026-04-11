import { createLocalFontProcessor } from "@unocss/preset-web-fonts/local";
import {
	defineConfig,
	presetAttributify,
	presetIcons,
	presetTypography,
	presetWebFonts,
	presetWind4,
	transformerDirectives,
	transformerVariantGroup,
} from "unocss";

export default defineConfig({
	shortcuts: [
		["app-shell", "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"],
		["section-gap", "py-12 sm:py-16 lg:py-20"],
		["surface-panel", "rounded-3xl border border-app-line/70 bg-white/90 p-6 shadow-[0_18px_50px_-36px_rgba(13,37,62,0.55)] backdrop-blur dark:border-app-line-dark dark:bg-app-panel-dark/95"],
		["focus-ring", "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-app-accent-strong focus-visible:ring-offset-3 focus-visible:ring-offset-app-bg dark:focus-visible:ring-offset-app-bg-dark"],
		["primary-link", "inline-flex items-center gap-2 font-medium text-app-accent transition hover:text-app-accent-strong"],
		["btn-primary", "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-app-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-app-ink-soft disabled:cursor-not-allowed disabled:opacity-60"],
		["btn-secondary", "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-app-line bg-app-bg px-5 py-3 text-sm font-semibold text-app-ink transition hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-transparent dark:text-app-text-dark"],
	],
	theme: {
		colors: {
			app: {
				"accent": "#2B6678",
				"accent-strong": "#1E4D5C",
				"bg": "#F7F4EE",
				"bg-dark": "#09131F",
				"ink": "#10253E",
				"ink-soft": "#1B3659",
				"line": "#D2D7DD",
				"line-dark": "#334458",
				"muted": "#667787",
				"muted-dark": "#91A0B4",
				"panel": "#FFFDFC",
				"panel-dark": "#112032",
				"text-dark": "#E6EDF4",
				"warm": "#E8D8B5",
			},
		},
	},
	presets: [
		presetWind4(),
		presetAttributify(),
		presetIcons({
			scale: 1.2,
		}),
		presetTypography(),
		presetWebFonts({
			fonts: {
				sans: "Public Sans",
				serif: "Source Serif 4",
				mono: "IBM Plex Mono",
			},
			processors: createLocalFontProcessor(),
		}),
	],
	transformers: [
		transformerDirectives(),
		transformerVariantGroup(),
	],
});
