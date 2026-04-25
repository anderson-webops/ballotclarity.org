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
		["app-shell", "mx-auto w-full max-w-[84rem] px-4 sm:px-6 lg:px-8"],
		["section-gap", "py-8 sm:py-12 lg:py-16"],
		["surface-panel", "rounded-[1.5rem] border border-app-line/80 bg-app-panel/92 p-4 shadow-[0_22px_56px_-42px_rgba(13,37,62,0.42)] backdrop-blur sm:rounded-[1.75rem] sm:p-5 dark:border-app-line-dark dark:bg-app-panel-dark/96"],
		["focus-ring", "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-app-accent-strong focus-visible:ring-offset-3 focus-visible:ring-offset-app-bg dark:focus-visible:ring-offset-app-bg-dark"],
		["primary-link", "inline-flex items-center gap-2 font-medium text-app-accent transition hover:text-app-accent-strong"],
		["btn-primary", "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-app-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-app-ink-soft disabled:cursor-not-allowed disabled:opacity-60 sm:px-5 sm:py-3"],
		["btn-secondary", "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-app-line bg-white px-4 py-2.5 text-sm font-semibold text-app-ink transition hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-transparent dark:text-app-text-dark sm:px-5 sm:py-3"],
	],
	theme: {
		colors: {
			app: {
				"accent": "rgb(var(--app-accent-rgb))",
				"accent-strong": "rgb(var(--app-accent-strong-rgb))",
				"bg": "rgb(var(--app-bg-rgb))",
				"bg-dark": "rgb(var(--app-bg-dark-rgb))",
				"ink": "rgb(var(--app-ink-rgb))",
				"ink-soft": "rgb(var(--app-ink-soft-rgb))",
				"line": "rgb(var(--app-line-rgb))",
				"line-dark": "rgb(var(--app-line-dark-rgb))",
				"muted": "rgb(var(--app-muted-rgb))",
				"muted-dark": "rgb(var(--app-muted-dark-rgb))",
				"panel": "rgb(var(--app-panel-rgb))",
				"panel-dark": "rgb(var(--app-panel-dark-rgb))",
				"text-dark": "rgb(var(--app-text-dark-rgb))",
				"warm": "rgb(var(--app-warm-rgb))",
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
