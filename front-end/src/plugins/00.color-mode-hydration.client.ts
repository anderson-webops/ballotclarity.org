import { globalName } from "#build/color-mode-options.mjs";
import { defineNuxtPlugin, useColorMode } from "#imports";
import { resolveColorModeHydrationState } from "~/utils/color-mode-hydration";

interface MutableColorModeState {
	preference: string;
	unknown: boolean;
	value: string;
}

export default defineNuxtPlugin({
	enforce: "pre",
	name: "color-mode-hydration",
	setup() {
		const colorMode = useColorMode() as MutableColorModeState;
		const helperCandidate = (window as typeof window & Record<string, unknown>)[globalName];
		const helperRecord = typeof helperCandidate === "object" && helperCandidate
			? helperCandidate as unknown as Record<string, unknown>
			: null;
		const helper = helperRecord
			? {
					preference: typeof helperRecord.preference === "string"
						? helperRecord.preference
						: null,
					value: typeof helperRecord.value === "string"
						? helperRecord.value
						: null
				}
			: null;
		const resolvedState = resolveColorModeHydrationState({
			className: document.documentElement.className,
			fallbackPreference: colorMode.preference,
			fallbackValue: colorMode.value,
			helper
		});

		colorMode.preference = resolvedState.preference;
		colorMode.value = resolvedState.value;
		colorMode.unknown = resolvedState.unknown;
	}
});
