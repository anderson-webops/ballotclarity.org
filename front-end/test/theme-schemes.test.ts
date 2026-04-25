import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultThemeScheme, getThemeTogglePreference, isDarkThemeValue, normalizeThemeScheme, themeSchemeOptions } from "../src/utils/theme-schemes.ts";

const mainCss = readFileSync(new URL("../src/assets/styles/main.css", import.meta.url), "utf8");
const appVue = readFileSync(new URL("../src/app.vue", import.meta.url), "utf8");
const appFooter = readFileSync(new URL("../src/components/AppFooter.vue", import.meta.url), "utf8");
const themeSchemePicker = readFileSync(new URL("../src/components/ThemeSchemePicker.vue", import.meta.url), "utf8");
const unoConfig = readFileSync(new URL("../uno.config.ts", import.meta.url), "utf8");

test("theme schemes match the CoFoundry palette families", () => {
	assert.equal(defaultThemeScheme, "ledger");
	assert.deepEqual(themeSchemeOptions.map(option => option.id), ["ledger", "foundry", "ember"]);
	assert.equal(normalizeThemeScheme("foundry"), "foundry");
	assert.equal(normalizeThemeScheme("ember"), "ember");
	assert.equal(normalizeThemeScheme("unknown"), defaultThemeScheme);
	assert.equal(normalizeThemeScheme(undefined), defaultThemeScheme);
});

test("theme helpers preserve light and dark mode semantics", () => {
	assert.equal(isDarkThemeValue("dark"), true);
	assert.equal(isDarkThemeValue("light"), false);
	assert.equal(isDarkThemeValue("system"), false);
	assert.equal(getThemeTogglePreference("dark"), "light");
	assert.equal(getThemeTogglePreference("light"), "dark");
});

test("each registered theme scheme has matching CSS variable blocks", () => {
	for (const option of themeSchemeOptions) {
		assert.match(mainCss, new RegExp(`data-theme-scheme="${option.id}"`));
		assert.match(mainCss, new RegExp(`html\\.dark\\[data-theme-scheme="${option.id}"\\]`));
	}
});

test("app theme system uses semantic CSS tokens and footer picker placement", () => {
	assert.match(appVue, /"data-theme-scheme": scheme\.value/);
	assert.match(appVue, /activeScheme\.value\.swatches\.light\.surface/);
	assert.match(appFooter, /<ThemeSchemePicker compact align="end" panel-align="end" \/>/);
	assert.match(themeSchemePicker, /useThemeScheme\(\)/);
	assert.match(themeSchemePicker, /aria-label="Color scheme picker"/);
	assert.match(unoConfig, /"accent": "rgb\(var\(--app-accent-rgb\)\)"/);
	assert.match(unoConfig, /"panel-dark": "rgb\(var\(--app-panel-dark-rgb\)\)"/);
	assert.doesNotMatch(unoConfig, /<alpha-value>/);
});
