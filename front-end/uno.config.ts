import {
	defineConfig,
	presetAttributify,
	presetIcons,
	presetTypography,
	presetWind4,
	transformerDirectives,
	transformerVariantGroup,
} from "unocss";

export default defineConfig({
	shortcuts: [
		["app-shell", "mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8"],
		["section-gap", "py-8 sm:py-10 lg:py-14"],
		["surface-panel", "rounded-xl border border-app-line bg-app-panel p-4 sm:p-6 dark:border-app-line-dark dark:bg-app-panel-dark"],
		["surface-primary", "rounded-2xl border border-app-line bg-app-panel p-5 shadow-[0_1px_2px_rgba(13,37,62,0.06),0_12px_32px_-24px_rgba(13,37,62,0.28)] sm:p-7 dark:border-app-line-dark dark:bg-app-panel-dark"],
		["surface-row", "rounded-lg border border-app-line bg-app-panel p-4 dark:border-app-line-dark dark:bg-app-panel-dark"],
		["surface-inset", "rounded-lg bg-app-bg p-4 dark:bg-app-bg-dark/70"],
		["eyebrow", "text-xs font-semibold uppercase tracking-[0.06em] text-app-muted dark:text-app-muted-dark"],
		["focus-ring", "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-app-accent-strong focus-visible:ring-offset-3 focus-visible:ring-offset-app-bg dark:focus-visible:ring-offset-app-bg-dark"],
		["primary-link", "inline-flex items-center gap-2 font-semibold text-app-accent underline decoration-app-accent/30 underline-offset-4 transition hover:text-app-accent-strong hover:decoration-current"],
		["btn-primary", "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-app-action px-4 py-2.5 text-[0.95rem] font-semibold text-app-action-text transition hover:bg-app-action-strong disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"],
		["btn-secondary", "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-app-line bg-app-panel px-4 py-2.5 text-[0.95rem] font-semibold text-app-ink transition hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-text-dark sm:px-5"],
	],
	theme: {
		colors: {
			app: {
				"accent": "rgb(var(--app-accent-rgb))",
				"accent-strong": "rgb(var(--app-accent-strong-rgb))",
				"action": "rgb(var(--app-action-rgb))",
				"action-strong": "rgb(var(--app-action-strong-rgb))",
				"action-text": "rgb(var(--app-action-text-rgb))",
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
		font: {
			mono: "\"IBM Plex Mono\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", monospace",
			sans: "\"Public Sans\", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
			serif: "\"Source Serif 4\", ui-serif, Georgia, Cambria, \"Times New Roman\", Times, serif",
		},
	},
	presets: [
		presetWind4(),
		presetAttributify(),
		presetIcons({
			scale: 1.2,
		}),
		presetTypography(),
	],
	transformers: [
		transformerDirectives(),
		transformerVariantGroup(),
	],
});
