import assert from "node:assert/strict";
import test from "node:test";
import {
	buildPreHydrationDisplayTimeZoneScript,
	detectBrowserDisplayTimeZone,
	displayTimeZoneCookieName,
	displayTimeZoneHtmlAttribute,
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

test("display time zone bootstrap script stores the browser time zone before hydration", () => {
	const script = buildPreHydrationDisplayTimeZoneScript();

	assert.match(script, new RegExp(displayTimeZoneCookieName));
	assert.match(script, new RegExp(displayTimeZoneHtmlAttribute));
	assert.match(script, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
});

test("display time zone utilities can detect the current browser time zone", () => {
	assert.ok(detectBrowserDisplayTimeZone());
});
