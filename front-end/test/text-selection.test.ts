import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { themeModes, themeSchemeDefinitions } from "../src/utils/theme-schemes.ts";

const mainCss = readFileSync(new URL("../src/assets/styles/main.css", import.meta.url), "utf8");

function luminance(hex: string) {
	const channels = hex.slice(1).match(/../gu)!.map(value => Number.parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
	return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrast(first: string, second: string) {
	const firstLuminance = luminance(first);
	const secondLuminance = luminance(second);
	return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

test("text selection uses an opaque semantic background and explicit foreground", () => {
	assert.match(mainCss, /::selection\s*\{\s*background: var\(--app-action\);\s*color: var\(--app-action-text\);\s*\}/u);
});

test("selected text is readable and visibly distinct in every palette and mode", () => {
	for (const scheme of themeSchemeDefinitions) {
		for (const mode of themeModes) {
			const tokens = scheme.modes[mode];
			const selectionBackground = tokens["--app-action"];
			assert.ok(contrast(selectionBackground, tokens["--app-action-text"]) >= 4.5, `${scheme.id}/${mode}: selected text`);
			for (const surface of ["--app-bg", "--app-panel"] as const)
				assert.ok(contrast(selectionBackground, tokens[surface]) >= 3, `${scheme.id}/${mode}: selection on ${surface}`);
		}
	}
});
