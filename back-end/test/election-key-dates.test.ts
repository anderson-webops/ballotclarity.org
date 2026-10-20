import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { demoElection } from "../src/coverage-data.js";

// Key-date timestamps are stored in UTC and displayed in the voter's local time zone.
// Fulton County polls close at 7:00 p.m. Eastern; on November 3, 2026 that is EST (UTC-5).
function easternClockTime(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone: "America/New_York",
	}).format(new Date(value));
}

function pollsCloseDate(keyDates: Array<{ date: string; label: string }>) {
	const entry = keyDates.find(item => /polls close/i.test(item.label));
	assert.ok(entry, "expected an Election Day polls-close key date");
	return entry.date;
}

test("seed election polls-close time is 7:00 PM Eastern", () => {
	assert.equal(easternClockTime(pollsCloseDate(demoElection.keyDates)), "7:00 PM");
});

for (const path of [
	"data/reviewed/fulton-county-2026-general.official-logistics-only.json",
	"data/live-coverage.local.json",
]) {
	test(`${path} polls-close time is 7:00 PM Eastern`, () => {
		const snapshot = JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8")) as {
			election: { keyDates: Array<{ date: string; label: string }> };
		};
		assert.equal(easternClockTime(pollsCloseDate(snapshot.election.keyDates)), "7:00 PM");
	});
}
