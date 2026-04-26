import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	defaultThemeScheme,
	getThemeTogglePreference,
	isDarkThemeValue,
	normalizeThemeScheme,
	themeCssVariableNames,
	themeModes,
	themeSchemeDefinitions,
	themeSchemeOptions,
	themeSchemeStyleContent
} from "../src/utils/theme-schemes.ts";

const mainCss = readFileSync(new URL("../src/assets/styles/main.css", import.meta.url), "utf8");
const appVue = readFileSync(new URL("../src/app.vue", import.meta.url), "utf8");
const appFooter = readFileSync(new URL("../src/components/AppFooter.vue", import.meta.url), "utf8");
const appHeader = readFileSync(new URL("../src/components/AppHeader.vue", import.meta.url), "utf8");
const adminLayout = readFileSync(new URL("../src/layouts/admin.vue", import.meta.url), "utf8");
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

test("each registered theme scheme generates matching CSS variable blocks", () => {
	for (const definition of themeSchemeDefinitions) {
		assert.match(themeSchemeStyleContent, new RegExp(`data-theme-scheme="${definition.id}"`));
		assert.match(themeSchemeStyleContent, new RegExp(`html\\.dark\\[data-theme-scheme="${definition.id}"\\]`));

		for (const mode of themeModes) {
			for (const name of themeCssVariableNames) {
				const variable = `--${name}`;
				assert.ok(themeSchemeStyleContent.includes(`${variable}: ${definition.modes[mode][variable]};`));
			}
		}
	}
});

test("app theme system uses semantic CSS tokens and footer picker placement", () => {
	assert.match(appVue, /"data-theme-scheme": scheme\.value/);
	assert.match(appVue, /activeScheme\.value\.swatches\.light\.surface/);
	assert.match(appVue, /themeSchemeStyleContent/);
	assert.match(appVue, /key: "ballot-clarity-theme-schemes"/);
	assert.match(mainCss, /Theme scheme color variables are generated from src\/utils\/theme-schemes\.ts/);
	assert.doesNotMatch(mainCss, /data-theme-scheme="foundry"/);
	assert.match(appFooter, /<ThemeSchemePicker compact align="end" panel-align="end" \/>/);
	assert.match(themeSchemePicker, /useThemeScheme\(\)/);
	assert.match(themeSchemePicker, /aria-label="Color scheme picker"/);
	assert.match(themeSchemePicker, />×<\/span>/);
	assert.match(unoConfig, /"accent": "rgb\(var\(--app-accent-rgb\)\)"/);
	assert.match(unoConfig, /"action": "rgb\(var\(--app-action-rgb\)\)"/);
	assert.match(unoConfig, /bg-app-action/);
	assert.match(unoConfig, /text-app-action-text/);
	assert.match(unoConfig, /"panel-dark": "rgb\(var\(--app-panel-dark-rgb\)\)"/);
	assert.doesNotMatch(unoConfig, /<alpha-value>/);
});

test("filled controls use contrast-safe action tokens", () => {
	assert.match(mainCss, /background: var\(--app-action\);/);
	assert.match(mainCss, /color: var\(--app-action-text\);/);
	assert.match(appHeader, /bg-app-action text-app-action-text/);
	assert.match(adminLayout, /bg-app-action text-app-action-text/);
	assert.doesNotMatch(unoConfig, /bg-app-ink .*text-white/);
	assert.doesNotMatch(appHeader, /bg-app-ink text-white/);
	assert.doesNotMatch(adminLayout, /bg-app-ink text-white/);
});
