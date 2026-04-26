export type ThemeValue = "dark" | "light";

export const themeModes = ["light", "dark"] as const satisfies readonly ThemeValue[];

export const themeCssVariableNames = [
	"app-bg",
	"app-bg-rgb",
	"app-bg-dark",
	"app-bg-dark-rgb",
	"app-ink",
	"app-ink-rgb",
	"app-ink-soft",
	"app-ink-soft-rgb",
	"app-text-dark",
	"app-text-dark-rgb",
	"app-muted",
	"app-muted-rgb",
	"app-muted-dark",
	"app-muted-dark-rgb",
	"app-line",
	"app-line-rgb",
	"app-line-dark",
	"app-line-dark-rgb",
	"app-accent",
	"app-accent-rgb",
	"app-accent-strong",
	"app-accent-strong-rgb",
	"app-panel",
	"app-panel-rgb",
	"app-panel-dark",
	"app-panel-dark-rgb",
	"app-warm",
	"app-warm-rgb",
	"app-bg-glow-primary",
	"app-bg-glow-secondary"
] as const;

export type ThemeCssVariableName = typeof themeCssVariableNames[number];
export type ThemeCssVariable = `--${ThemeCssVariableName}`;
export type ThemeTokenSet = Record<ThemeCssVariable, string>;

interface ThemeSchemeDefinition {
	description: string;
	id: string;
	isDefault?: boolean;
	label: string;
	modes: Record<ThemeValue, ThemeTokenSet>;
}

type ThemeSchemeDefinitionList = readonly [ThemeSchemeDefinition, ...ThemeSchemeDefinition[]];

/*
 * Theme scheme integration contract:
 * - Add or edit palette families in this definition list only.
 * - Keep product UI on semantic CSS variables such as --app-bg, --app-ink, and --app-accent.
 * - Picker swatches and injected CSS are generated from these same tokens.
 */
export const themeSchemeDefinitions = [
	{
		description: "Cool slate surfaces with a cobalt signal accent.",
		id: "ledger",
		isDefault: true,
		label: "Ledger",
		modes: {
			dark: {
				"--app-accent": "#7ea2ff",
				"--app-accent-rgb": "126 162 255",
				"--app-accent-strong": "#a3bdff",
				"--app-accent-strong-rgb": "163 189 255",
				"--app-bg": "#0d1117",
				"--app-bg-dark": "#0d1117",
				"--app-bg-dark-rgb": "13 17 23",
				"--app-bg-glow-primary": "rgba(64, 110, 225, 0.16)",
				"--app-bg-glow-secondary": "rgba(6, 10, 19, 0.22)",
				"--app-bg-rgb": "13 17 23",
				"--app-ink": "#f4f7fb",
				"--app-ink-rgb": "244 247 251",
				"--app-ink-soft": "#dce7ff",
				"--app-ink-soft-rgb": "220 231 255",
				"--app-line": "#2c3442",
				"--app-line-dark": "#2c3442",
				"--app-line-dark-rgb": "44 52 66",
				"--app-line-rgb": "44 52 66",
				"--app-muted": "#98a5b8",
				"--app-muted-dark": "#98a5b8",
				"--app-muted-dark-rgb": "152 165 184",
				"--app-muted-rgb": "152 165 184",
				"--app-panel": "#111621",
				"--app-panel-dark": "#111621",
				"--app-panel-dark-rgb": "17 22 33",
				"--app-panel-rgb": "17 22 33",
				"--app-text-dark": "#f4f7fb",
				"--app-text-dark-rgb": "244 247 251",
				"--app-warm": "#263b67",
				"--app-warm-rgb": "38 59 103"
			},
			light: {
				"--app-accent": "#2557d6",
				"--app-accent-rgb": "37 87 214",
				"--app-accent-strong": "#1c45b0",
				"--app-accent-strong-rgb": "28 69 176",
				"--app-bg": "#f4f5f8",
				"--app-bg-dark": "#0d1117",
				"--app-bg-dark-rgb": "13 17 23",
				"--app-bg-glow-primary": "rgba(37, 87, 214, 0.12)",
				"--app-bg-glow-secondary": "rgba(12, 22, 43, 0.09)",
				"--app-bg-rgb": "244 245 248",
				"--app-ink": "#121722",
				"--app-ink-rgb": "18 23 34",
				"--app-ink-soft": "#1b2b49",
				"--app-ink-soft-rgb": "27 43 73",
				"--app-line": "#d8dee7",
				"--app-line-dark": "#2c3442",
				"--app-line-dark-rgb": "44 52 66",
				"--app-line-rgb": "216 222 231",
				"--app-muted": "#657080",
				"--app-muted-dark": "#98a5b8",
				"--app-muted-dark-rgb": "152 165 184",
				"--app-muted-rgb": "101 112 128",
				"--app-panel": "#ffffff",
				"--app-panel-dark": "#111621",
				"--app-panel-dark-rgb": "17 22 33",
				"--app-panel-rgb": "255 255 255",
				"--app-text-dark": "#f4f7fb",
				"--app-text-dark-rgb": "244 247 251",
				"--app-warm": "#d8e3ff",
				"--app-warm-rgb": "216 227 255"
			}
		}
	},
	{
		description: "The mint-and-graphite CoFoundry palette.",
		id: "foundry",
		label: "Foundry",
		modes: {
			dark: {
				"--app-accent": "#5ac3a8",
				"--app-accent-rgb": "90 195 168",
				"--app-accent-strong": "#74d5bc",
				"--app-accent-strong-rgb": "116 213 188",
				"--app-bg": "#0d1110",
				"--app-bg-dark": "#0d1110",
				"--app-bg-dark-rgb": "13 17 16",
				"--app-bg-glow-primary": "rgba(19, 108, 89, 0.12)",
				"--app-bg-glow-secondary": "rgba(4, 9, 8, 0.22)",
				"--app-bg-rgb": "13 17 16",
				"--app-ink": "#f4f6f5",
				"--app-ink-rgb": "244 246 245",
				"--app-ink-soft": "#d9f4ed",
				"--app-ink-soft-rgb": "217 244 237",
				"--app-line": "#2a3330",
				"--app-line-dark": "#2a3330",
				"--app-line-dark-rgb": "42 51 48",
				"--app-line-rgb": "42 51 48",
				"--app-muted": "#9aa39f",
				"--app-muted-dark": "#9aa39f",
				"--app-muted-dark-rgb": "154 163 159",
				"--app-muted-rgb": "154 163 159",
				"--app-panel": "#131918",
				"--app-panel-dark": "#131918",
				"--app-panel-dark-rgb": "19 25 24",
				"--app-panel-rgb": "19 25 24",
				"--app-text-dark": "#f4f6f5",
				"--app-text-dark-rgb": "244 246 245",
				"--app-warm": "#203d35",
				"--app-warm-rgb": "32 61 53"
			},
			light: {
				"--app-accent": "#136c59",
				"--app-accent-rgb": "19 108 89",
				"--app-accent-strong": "#0e5849",
				"--app-accent-strong-rgb": "14 88 73",
				"--app-bg": "#f5f4ef",
				"--app-bg-dark": "#0d1110",
				"--app-bg-dark-rgb": "13 17 16",
				"--app-bg-glow-primary": "rgba(19, 108, 89, 0.08)",
				"--app-bg-glow-secondary": "rgba(15, 23, 21, 0.08)",
				"--app-bg-rgb": "245 244 239",
				"--app-ink": "#121715",
				"--app-ink-rgb": "18 23 21",
				"--app-ink-soft": "#1b302b",
				"--app-ink-soft-rgb": "27 48 43",
				"--app-line": "#dadbd6",
				"--app-line-dark": "#2a3330",
				"--app-line-dark-rgb": "42 51 48",
				"--app-line-rgb": "218 219 214",
				"--app-muted": "#66706c",
				"--app-muted-dark": "#9aa39f",
				"--app-muted-dark-rgb": "154 163 159",
				"--app-muted-rgb": "102 112 108",
				"--app-panel": "#fffefa",
				"--app-panel-dark": "#131918",
				"--app-panel-dark-rgb": "19 25 24",
				"--app-panel-rgb": "255 254 250",
				"--app-text-dark": "#f4f6f5",
				"--app-text-dark-rgb": "244 246 245",
				"--app-warm": "#d9e8df",
				"--app-warm-rgb": "217 232 223"
			}
		}
	},
	{
		description: "Warm stone surfaces with a restrained copper accent.",
		id: "ember",
		label: "Ember",
		modes: {
			dark: {
				"--app-accent": "#e09a64",
				"--app-accent-rgb": "224 154 100",
				"--app-accent-strong": "#f0b07c",
				"--app-accent-strong-rgb": "240 176 124",
				"--app-bg": "#120f0d",
				"--app-bg-dark": "#120f0d",
				"--app-bg-dark-rgb": "18 15 13",
				"--app-bg-glow-primary": "rgba(224, 154, 100, 0.12)",
				"--app-bg-glow-secondary": "rgba(9, 6, 5, 0.2)",
				"--app-bg-rgb": "18 15 13",
				"--app-ink": "#f6f1ed",
				"--app-ink-rgb": "246 241 237",
				"--app-ink-soft": "#f1c09b",
				"--app-ink-soft-rgb": "241 192 155",
				"--app-line": "#3b312c",
				"--app-line-dark": "#3b312c",
				"--app-line-dark-rgb": "59 49 44",
				"--app-line-rgb": "59 49 44",
				"--app-muted": "#b3a59c",
				"--app-muted-dark": "#b3a59c",
				"--app-muted-dark-rgb": "179 165 156",
				"--app-muted-rgb": "179 165 156",
				"--app-panel": "#1a1513",
				"--app-panel-dark": "#1a1513",
				"--app-panel-dark-rgb": "26 21 19",
				"--app-panel-rgb": "26 21 19",
				"--app-text-dark": "#f6f1ed",
				"--app-text-dark-rgb": "246 241 237",
				"--app-warm": "#4b2f22",
				"--app-warm-rgb": "75 47 34"
			},
			light: {
				"--app-accent": "#a85a30",
				"--app-accent-rgb": "168 90 48",
				"--app-accent-strong": "#8b4725",
				"--app-accent-strong-rgb": "139 71 37",
				"--app-bg": "#f6f2ed",
				"--app-bg-dark": "#120f0d",
				"--app-bg-dark-rgb": "18 15 13",
				"--app-bg-glow-primary": "rgba(168, 90, 48, 0.11)",
				"--app-bg-glow-secondary": "rgba(47, 23, 16, 0.07)",
				"--app-bg-rgb": "246 242 237",
				"--app-ink": "#1c1613",
				"--app-ink-rgb": "28 22 19",
				"--app-ink-soft": "#36221a",
				"--app-ink-soft-rgb": "54 34 26",
				"--app-line": "#dfd7d0",
				"--app-line-dark": "#3b312c",
				"--app-line-dark-rgb": "59 49 44",
				"--app-line-rgb": "223 215 208",
				"--app-muted": "#776b63",
				"--app-muted-dark": "#b3a59c",
				"--app-muted-dark-rgb": "179 165 156",
				"--app-muted-rgb": "119 107 99",
				"--app-panel": "#fffaf6",
				"--app-panel-dark": "#1a1513",
				"--app-panel-dark-rgb": "26 21 19",
				"--app-panel-rgb": "255 250 246",
				"--app-text-dark": "#f6f1ed",
				"--app-text-dark-rgb": "246 241 237",
				"--app-warm": "#ead3bd",
				"--app-warm-rgb": "234 211 189"
			}
		}
	}
] as const satisfies ThemeSchemeDefinitionList;

export type ThemeSchemeId = typeof themeSchemeDefinitions[number]["id"];

export interface ThemeSchemeOption {
	description: string;
	id: ThemeSchemeId;
	isDefault?: boolean;
	label: string;
	swatches: Record<ThemeValue, {
		accent: string;
		surface: string;
		text: string;
	}>;
}

export const defaultThemeSchemeDefinition = themeSchemeDefinitions.find(isDefaultThemeSchemeDefinition) ?? themeSchemeDefinitions[0];
export const defaultThemeScheme = defaultThemeSchemeDefinition.id;

export const themeSchemeOptions: readonly ThemeSchemeOption[] = themeSchemeDefinitions.map(option => ({
	description: option.description,
	id: option.id,
	isDefault: isDefaultThemeSchemeDefinition(option) ? option.isDefault : undefined,
	label: option.label,
	swatches: {
		dark: createThemeSwatch(option.modes.dark),
		light: createThemeSwatch(option.modes.light)
	}
}));

export const themeSchemeStyleContent = createThemeSchemeStyleContent();

export function isDarkThemeValue(value: string) {
	return value === "dark";
}

export function getThemeTogglePreference(value: string): ThemeValue {
	return isDarkThemeValue(value) ? "light" : "dark";
}

export function normalizeThemeScheme(value?: string | null): ThemeSchemeId {
	return isThemeSchemeId(value) ? value : defaultThemeScheme;
}

export function isThemeSchemeId(value?: string | null): value is ThemeSchemeId {
	return themeSchemeDefinitions.some(option => option.id === value);
}

function createThemeSwatch(tokens: ThemeTokenSet) {
	return {
		accent: tokens["--app-accent"],
		surface: tokens["--app-bg"],
		text: tokens["--app-ink"]
	};
}

function isDefaultThemeSchemeDefinition(
	option: typeof themeSchemeDefinitions[number]
): option is typeof themeSchemeDefinitions[number] & { readonly isDefault: true } {
	return "isDefault" in option && option.isDefault;
}

function createThemeSchemeStyleContent() {
	return themeSchemeDefinitions
		.flatMap(option => [
			createThemeBlock(createLightSelector(option), option.modes.light),
			createThemeBlock(createDarkSelector(option), option.modes.dark)
		])
		.join("\n\n");
}

function createLightSelector(option: typeof themeSchemeDefinitions[number]) {
	return option.id === defaultThemeScheme
		? `:root,\n:root[data-theme-scheme="${option.id}"]`
		: `:root[data-theme-scheme="${option.id}"]`;
}

function createDarkSelector(option: typeof themeSchemeDefinitions[number]) {
	return option.id === defaultThemeScheme
		? `html.dark,\nhtml.dark[data-theme-scheme="${option.id}"]`
		: `html.dark[data-theme-scheme="${option.id}"]`;
}

function createThemeBlock(selector: string, tokens: ThemeTokenSet) {
	const declarations = themeCssVariableNames.map((name) => {
		const variable = `--${name}` as ThemeCssVariable;
		return `  ${variable}: ${tokens[variable]};`;
	});

	return `${selector} {\n${declarations.join("\n")}\n}`;
}
