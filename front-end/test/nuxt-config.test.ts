import assert from "node:assert/strict";
import test from "node:test";
import { pwa } from "../src/config/pwa.ts";
import { appDescription, appName } from "../src/constants/index.ts";

test("nuxt config uses srcDir and expected civic modules", async () => {
	const { default: config } = await import("../nuxt.config.ts");

	assert.equal(config.srcDir, "src");
	assert.deepEqual(
		config.modules?.sort(),
		["@nuxt/eslint", "@nuxtjs/color-mode", "@pinia/nuxt", "@unocss/nuxt", "@vite-pwa/nuxt", "@vueuse/nuxt"].sort()
	);
	assert.equal(config.runtimeConfig?.public?.apiBase, "http://127.0.0.1:3001/api");
	assert.equal(config.colorMode?.preference, "light");
	assert.equal(config.experimental?.typedPages, true);
	assert.deepEqual(config.vite?.build?.modulePreload, { polyfill: false });
});

test("pwa config preserves Ballot Clarity branding and API fallback rules", () => {
	assert.equal(pwa.manifest?.name, appName);
	assert.equal(pwa.manifest?.description, appDescription);
	assert.equal(pwa.manifest?.short_name, "Ballot Clarity");
	assert.equal(pwa.workbox?.navigateFallback, "/");
	assert.ok(pwa.workbox?.navigateFallbackDenylist?.some(pattern => pattern.test("/api/ballot")));
});
