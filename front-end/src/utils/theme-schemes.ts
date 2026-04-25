export type ThemeValue = "dark" | "light";

export interface ThemeSchemeSwatches {
	dark: {
		accent: string;
		surface: string;
		text: string;
	};
	light: {
		accent: string;
		surface: string;
		text: string;
	};
}

export interface ThemeSchemeOption {
	description: string;
	id: string;
	isDefault?: boolean;
	label: string;
	swatches: ThemeSchemeSwatches;
}

export const themeSchemeOptions = [
	{
		description: "Cool slate surfaces with a cobalt signal accent.",
		id: "ledger",
		isDefault: true,
		label: "Ledger",
		swatches: {
			dark: {
				accent: "#7ea2ff",
				surface: "#0d1117",
				text: "#f4f7fb"
			},
			light: {
				accent: "#2557d6",
				surface: "#f4f5f8",
				text: "#121722"
			}
		}
	},
	{
		description: "The mint-and-graphite CoFoundry palette.",
		id: "foundry",
		isDefault: false,
		label: "Foundry",
		swatches: {
			dark: {
				accent: "#5ac3a8",
				surface: "#0d1110",
				text: "#f4f6f5"
			},
			light: {
				accent: "#136c59",
				surface: "#f5f4ef",
				text: "#121715"
			}
		}
	},
	{
		description: "Warm stone surfaces with a restrained copper accent.",
		id: "ember",
		isDefault: false,
		label: "Ember",
		swatches: {
			dark: {
				accent: "#e09a64",
				surface: "#120f0d",
				text: "#f6f1ed"
			},
			light: {
				accent: "#a85a30",
				surface: "#f6f2ed",
				text: "#1c1613"
			}
		}
	}
] as const satisfies readonly ThemeSchemeOption[];

export type ThemeSchemeId = typeof themeSchemeOptions[number]["id"];

export const defaultThemeScheme: ThemeSchemeId = "ledger";

export function isDarkThemeValue(value: string) {
	return value === "dark";
}

export function getThemeTogglePreference(value: string): ThemeValue {
	return isDarkThemeValue(value) ? "light" : "dark";
}

export function normalizeThemeScheme(value?: string | null): ThemeSchemeId {
	return themeSchemeOptions.some(option => option.id === value)
		? value as ThemeSchemeId
		: defaultThemeScheme;
}
