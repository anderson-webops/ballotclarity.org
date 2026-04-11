import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { appDescription, appName } from "../src/constants/index.ts";

test("nuxt config uses srcDir and expected civic modules", async () => {
	const { default: config } = await import("../nuxt.config.ts");

	assert.equal(config.srcDir, "src");
	assert.deepEqual(
		config.modules?.sort(),
		["@nuxt/eslint", "@nuxtjs/color-mode", "@pinia/nuxt", "@unocss/nuxt", "@vueuse/nuxt"].sort()
	);
	assert.equal(config.runtimeConfig?.public?.apiBase, "http://127.0.0.1:3001/api");
	assert.equal(config.colorMode?.preference, "light");
	assert.equal(config.experimental?.typedPages, true);
	assert.deepEqual(config.vite?.build?.modulePreload, { polyfill: false });
	assert.ok(config.app?.head?.link?.some(link => link.rel === "manifest" && link.href === "/site.webmanifest"));
});

test("web manifest preserves Ballot Clarity branding", () => {
	const manifest = JSON.parse(readFileSync(new URL("../public/site.webmanifest", import.meta.url), "utf8"));

	assert.equal(manifest.name, appName);
	assert.equal(manifest.description, appDescription);
	assert.equal(manifest.short_name, "Ballot Clarity");
	assert.equal(manifest.start_url, "/");
	assert.equal(manifest.scope, "/");
	assert.equal(manifest.display, "standalone");
	assert.ok(Array.isArray(manifest.icons));
	assert.ok(manifest.icons.some(icon => icon.src === "/maskable-icon.png"));
});
