import assert from "node:assert/strict";
import test from "node:test";
import { resolveColorModeHydrationState } from "../src/utils/color-mode-hydration.ts";

test("color mode hydration state follows the pre-hydration helper when it is available", () => {
	const resolvedState = resolveColorModeHydrationState({
		className: "light",
		fallbackPreference: "system",
		fallbackValue: "light",
		helper: {
			preference: "system",
			value: "dark"
		}
	});

	assert.deepEqual(resolvedState, {
		preference: "system",
		unknown: false,
		value: "dark"
	});
});

test("color mode hydration state falls back to the already-applied document class when helper data is missing", () => {
	const resolvedState = resolveColorModeHydrationState({
		className: "app-shell dark",
		fallbackPreference: "system",
		fallbackValue: "light",
		helper: null
	});

	assert.deepEqual(resolvedState, {
		preference: "system",
		unknown: false,
		value: "dark"
	});
});

test("color mode hydration state falls back to light when neither helper data nor document classes are available", () => {
	const resolvedState = resolveColorModeHydrationState({
		className: "",
		fallbackPreference: null,
		fallbackValue: null,
		helper: null
	});

	assert.deepEqual(resolvedState, {
		preference: "light",
		unknown: false,
		value: "light"
	});
});
