import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	buildPreHydrationDisplayTimeZoneScript,
	detectBrowserDisplayTimeZone,
	displayTimeZoneCookieName,
	displayTimeZoneHtmlAttribute,
	formatCivicDate,
	formatCivicDateTime,
	normalizeDisplayTimeZone,
	readDisplayTimeZoneFromDocument,
	writeDisplayTimeZoneToDocument,
} from "../src/utils/display-time-zone.ts";

test("display time zone utilities normalize valid time zones and reject invalid values", () => {
	assert.equal(normalizeDisplayTimeZone("America/New_York"), "America/New_York");
	assert.equal(normalizeDisplayTimeZone("UTC"), "UTC");
	assert.equal(normalizeDisplayTimeZone("not-a-real-zone"), null);
});

test("display time zone utilities can read and write the html time zone attribute", () => {
	const documentElement = {
		attributes: new Map<string, string>(),
		getAttribute(name: string) {
			return this.attributes.get(name) ?? null;
		},
		setAttribute(name: string, value: string) {
			this.attributes.set(name, value);
		},
	};
	const fakeDocument = { documentElement } as unknown as Pick<Document, "documentElement">;

	assert.equal(writeDisplayTimeZoneToDocument(fakeDocument, "America/Denver"), "America/Denver");
	assert.equal(readDisplayTimeZoneFromDocument(fakeDocument), "America/Denver");
	assert.equal(documentElement.getAttribute(displayTimeZoneHtmlAttribute), "America/Denver");
});

test("display time zone utilities format date-times in the supplied time zone", () => {
	assert.equal(formatCivicDateTime("2026-04-18T18:45:00.000Z", "UTC"), "Apr 18, 2026, 6:45 PM");
	assert.equal(formatCivicDateTime("2026-04-18T18:45:00.000Z", "America/New_York"), "Apr 18, 2026, 2:45 PM");
	assert.equal(formatCivicDateTime("2026-04-18T18:45:00.000Z", "America/Denver"), "Apr 18, 2026, 12:45 PM");
});

test("reporting timestamps without an offset preserve their calendar fields across display zones", () => {
	for (const timeZone of ["UTC", "America/New_York", "Pacific/Honolulu", "Asia/Tokyo"]) {
		assert.equal(formatCivicDateTime("2026-09-30T00:00:00", timeZone), "Sep 30, 2026, 12:00 AM");
		assert.equal(formatCivicDateTime("2026-09-30T12:30:45.250", timeZone), "Sep 30, 2026, 12:30 PM");
		assert.equal(formatCivicDate("2026-09-30T23:45", timeZone), "September 30, 2026");
	}
});

test("timestamps with a stated offset continue to convert to the reader's time zone", () => {
	assert.equal(formatCivicDateTime("2026-09-30T00:00:00Z", "America/New_York"), "Sep 29, 2026, 8:00 PM");
	assert.equal(formatCivicDateTime("2026-09-30T00:00:00-04:00", "Asia/Tokyo"), "Sep 30, 2026, 1:00 PM");
});

test("display time zone bootstrap script stores the browser time zone before hydration", () => {
	const script = buildPreHydrationDisplayTimeZoneScript();

	assert.match(script, new RegExp(displayTimeZoneCookieName));
	assert.match(script, new RegExp(displayTimeZoneHtmlAttribute));
	assert.match(script, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
});

test("display time zone utilities can detect the current browser time zone", () => {
	assert.ok(detectBrowserDisplayTimeZone());
});

test("display time zone rendering keeps a serialized fallback until Nuxt hydration completes", () => {
	const formatters = readFileSync(new URL("../src/composables/useFormatters.ts", import.meta.url), "utf8");
	const plugin = readFileSync(new URL("../src/plugins/01.display-time-zone.client.ts", import.meta.url), "utf8");
	assert.match(formatters, /return normalizeDisplayTimeZone\(cookie\.value\) \?\? "UTC"/u);
	assert.match(plugin, /onNuxtReady\(\(\) => \{[\s\S]*displayTimeZone\.value = resolvedDisplayTimeZone/u);
	assert.doesNotMatch(plugin, /app:mounted/u);
});
