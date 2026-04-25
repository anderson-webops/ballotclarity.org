import type { ThemeSchemeId } from "~/utils/theme-schemes";
import { defaultThemeScheme, normalizeThemeScheme, themeSchemeOptions } from "~/utils/theme-schemes";

export const themeSchemeCookieName = "ballot-clarity-theme-scheme";

export function useThemeScheme() {
	const themeSchemeCookie = useCookie<string>(themeSchemeCookieName, {
		default: () => defaultThemeScheme,
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax"
	});

	const scheme = computed<ThemeSchemeId>({
		get: () => normalizeThemeScheme(themeSchemeCookie.value),
		set: (value) => {
			themeSchemeCookie.value = normalizeThemeScheme(value);
		}
	});
	const activeScheme = computed(() => themeSchemeOptions.find(option => option.id === scheme.value) ?? themeSchemeOptions[0]);

	return {
		activeScheme,
		scheme,
		schemes: themeSchemeOptions
	};
}
