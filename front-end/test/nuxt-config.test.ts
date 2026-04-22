import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyticsDomain, analyticsWebsiteId, appDescription, appName } from "../src/constants/index.ts";
import { staleClientBuildStorageKey } from "../src/utils/deploy-recovery.ts";
import { displayTimeZoneCookieName } from "../src/utils/display-time-zone.ts";

test("nuxt config uses srcDir and expected civic modules", async () => {
	const { default: config } = await import("../nuxt.config.ts");

	assert.equal(config.srcDir, "src");
	assert.deepEqual(
		config.modules?.sort(),
		["@nuxt/eslint", "@nuxtjs/color-mode", "@pinia/nuxt", "@unocss/nuxt", "@vueuse/nuxt"].sort()
	);
	assert.equal(config.runtimeConfig?.public?.apiBase, "http://127.0.0.1:3001/api");
	assert.ok(typeof config.runtimeConfig?.public?.buildId === "string" && config.runtimeConfig.public.buildId.length > 0);
	assert.equal(config.runtimeConfig?.public?.siteUrl, "https://ballotclarity.org");
	assert.equal(config.colorMode?.preference, "system");
	assert.equal(config.experimental?.typedPages, true);
	assert.deepEqual(config.vite?.build?.modulePreload, { polyfill: false });
	assert.equal(config.app?.head?.htmlAttrs?.lang, "en");
	assert.equal(config.app?.head?.htmlAttrs?.["data-app-build"], config.runtimeConfig?.public?.buildId);
	assert.ok(config.app?.head?.meta?.some(meta => meta.name === "ballot-clarity-build-id" && meta.content === config.runtimeConfig?.public?.buildId));
	assert.ok(config.app?.head?.script?.some(script =>
		script.id === "ballot-clarity-display-time-zone"
		&& typeof script.innerHTML === "string"
		&& script.innerHTML.includes(displayTimeZoneCookieName)
		&& script.innerHTML.includes("Intl.DateTimeFormat().resolvedOptions().timeZone")
	));
	assert.ok(config.app?.head?.script?.some(script =>
		script.id === "ballot-clarity-deploy-recovery"
		&& typeof script.innerHTML === "string"
		&& script.innerHTML.includes(staleClientBuildStorageKey)
		&& script.innerHTML.includes("window.location.reload()")
	));
	assert.ok(config.app?.head?.script?.some(script =>
		script.src === `https://${analyticsDomain}/script.js`
		&& script["data-website-id"] === analyticsWebsiteId
		&& script.defer === true
	));
	assert.ok(config.app?.head?.link?.some(link => link.rel === "manifest" && typeof link.href === "string" && link.href.startsWith("/site.webmanifest")));
	assert.equal(config.nitro?.routeRules?.["/_nuxt/**"]?.headers?.["cache-control"], "public, max-age=31536000, immutable");
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
	assert.ok(manifest.icons.some(icon => typeof icon.src === "string" && icon.src.startsWith("/maskable-icon.png")));
});
