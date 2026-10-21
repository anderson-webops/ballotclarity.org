import assert from "node:assert/strict";
import test from "node:test";
import { buildKeyDateTimeline, calendarDaysUntil, describeDaysAway } from "../src/utils/election-timeline.ts";

const timeZone = "America/New_York";
// 10:30 a.m. Eastern on Tuesday, October 20, 2026.
const now = new Date("2026-10-20T14:30:00.000Z");

test("calendar day counts follow the reader's time zone", () => {
	assert.equal(calendarDaysUntil("2026-11-03", now, timeZone), 14);
	assert.equal(calendarDaysUntil("2026-10-20", now, timeZone), 0);
	assert.equal(calendarDaysUntil("2026-10-05", now, timeZone), -15);
	// 7:00 p.m. Eastern on Election Day.
	assert.equal(calendarDaysUntil("2026-11-04T00:00:00.000Z", now, timeZone), 14);
	// Late evening Eastern is already the next UTC day; the count still uses the local calendar.
	assert.equal(calendarDaysUntil("2026-10-21T12:00:00.000Z", new Date("2026-10-21T02:00:00.000Z"), timeZone), 1);
});

test("relative labels read naturally", () => {
	assert.equal(describeDaysAway(-3), "Passed");
	assert.equal(describeDaysAway(0), "Today");
	assert.equal(describeDaysAway(1), "Tomorrow");
	assert.equal(describeDaysAway(10), "In 10 days");
});

test("key dates are sorted chronologically with the next upcoming date flagged", () => {
	const timeline = buildKeyDateTimeline([
		{ date: "2026-10-05", label: "Registration deadline" },
		{ date: "2026-10-23", label: "Vote-by-mail request deadline" },
		{ date: "2026-10-13", label: "Early voting opens" },
		{ date: "2026-10-30", label: "Early voting ends" },
		{ date: "2026-11-04T00:00:00.000Z", label: "Election Day polls close" }
	], now, timeZone);

	assert.deepEqual(timeline.map(entry => entry.label), [
		"Registration deadline",
		"Early voting opens",
		"Vote-by-mail request deadline",
		"Early voting ends",
		"Election Day polls close"
	]);
	assert.deepEqual(timeline.map(entry => entry.status), ["passed", "passed", "upcoming", "upcoming", "upcoming"]);
	assert.deepEqual(timeline.map(entry => entry.isNext), [false, false, true, false, false]);
	assert.equal(timeline[2]?.relativeLabel, "In 3 days");
});

test("a timed deadline earlier today counts as passed", () => {
	const timeline = buildKeyDateTimeline([
		{ date: "2026-10-20T13:00:00.000Z", label: "Morning deadline" },
		{ date: "2026-10-20", label: "All-day window" }
	], now, timeZone);

	assert.deepEqual(timeline.map(entry => [entry.label, entry.status, entry.isNext]), [
		["All-day window", "today", true],
		["Morning deadline", "passed", false]
	]);
});
