import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { themeSchemeDefinitions } from "../src/utils/theme-schemes.ts";

function luminance(hex: string) {
	const channels = hex.slice(1).match(/../gu)!.map(value => Number.parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
	return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

test("attention dates use AA-readable red in every palette and mode", () => {
	const css = readFileSync(new URL("../src/assets/styles/main.css", import.meta.url), "utf8");
	assert.match(css, /\.attention-date\s*\{\s*color: #b91c1c;/u);
	assert.match(css, /html\.dark \.attention-date\s*\{\s*color: #fca5a5;/u);
	for (const scheme of themeSchemeDefinitions) {
		for (const mode of ["light", "dark"] as const) {
			const foreground = luminance(mode === "light" ? "#b91c1c" : "#fca5a5");
			for (const token of ["--app-bg", "--app-panel"] as const) {
				const background = luminance(scheme.modes[mode][token]);
				const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
				assert.ok(contrast >= 4.5, `${scheme.id}/${mode}/${token}: ${contrast}`);
			}
		}
	}
});

test("deadline styling is scoped to consequential dates, not source freshness", () => {
	const preview = readFileSync(new URL("../src/components/BallotContentPreviews.vue", import.meta.url), "utf8");
	assert.match(preview, /attention-date[^>]*>\{\{ formatDate\(preview.electionDate\)/u);
	assert.doesNotMatch(preview, /attention-date[^>]*>\{\{ formatDateTime\(preview.generatedAt\)/u);
	const timeline = readFileSync(new URL("../src/pages/elections/[slug].vue", import.meta.url), "utf8");
	assert.match(timeline, /'attention-date': item.status !== 'passed'/u);
});
