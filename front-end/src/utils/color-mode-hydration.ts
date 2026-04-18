export type ResolvedColorModeValue = "dark" | "light";

export interface ColorModeHelperSnapshot {
	preference?: string | null;
	value?: string | null;
}

export interface ColorModeHydrationInput {
	className?: string | null;
	fallbackPreference?: string | null;
	fallbackValue?: string | null;
	helper?: ColorModeHelperSnapshot | null;
}

export interface ResolvedColorModeState {
	preference: string;
	unknown: false;
	value: ResolvedColorModeValue;
}

const whitespacePattern = /\s+/;

function isResolvedColorModeValue(value: string | null | undefined): value is ResolvedColorModeValue {
	return value === "dark" || value === "light";
}

function inferValueFromClassName(className?: string | null) {
	if (!className)
		return null;

	const classes = new Set(className.split(whitespacePattern).filter(Boolean));

	if (classes.has("dark"))
		return "dark";

	if (classes.has("light"))
		return "light";

	return null;
}

export function resolveColorModeHydrationState(
	input: ColorModeHydrationInput
): ResolvedColorModeState {
	const helperPreference = input.helper?.preference?.trim();
	const helperValue = input.helper?.value?.trim();
	const fallbackPreference = input.fallbackPreference?.trim();
	const fallbackValue = input.fallbackValue?.trim();
	const inferredValue = inferValueFromClassName(input.className);
	const resolvedValue = isResolvedColorModeValue(helperValue)
		? helperValue
		: inferredValue
			?? (isResolvedColorModeValue(fallbackValue) ? fallbackValue : "light");
	const resolvedPreference = helperPreference || fallbackPreference || resolvedValue;

	return {
		preference: resolvedPreference,
		unknown: false,
		value: resolvedValue
	};
}
