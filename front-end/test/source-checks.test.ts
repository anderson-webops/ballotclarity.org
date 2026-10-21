import assert from "node:assert/strict";
import test from "node:test";
import { orderScheduledSourceChecks } from "../src/utils/source-checks.ts";

const now = new Date("2026-10-20T15:00:00.000Z");

test("past check dates are flagged overdue and listed before upcoming checks", () => {
	const ordered = orderScheduledSourceChecks([
		{ id: "upcoming-later", nextCheckAt: "2026-11-01T12:00:00.000Z" },
		{ id: "overdue-recent", nextCheckAt: "2026-10-01T12:00:00.000Z" },
		{ id: "upcoming-soon", nextCheckAt: "2026-10-21T12:00:00.000Z" },
		{ id: "overdue-oldest", nextCheckAt: "2026-04-01T12:00:00.000Z" }
	], now);

	assert.deepEqual(ordered.map(entry => [entry.check.id, entry.isOverdue]), [
		["overdue-oldest", true],
		["overdue-recent", true],
		["upcoming-soon", false],
		["upcoming-later", false]
	]);
});

test("invalid dates are skipped and the list is capped", () => {
	const ordered = orderScheduledSourceChecks([
		{ id: "bad", nextCheckAt: "not a date" },
		...Array.from({ length: 6 }, (_, index) => ({ id: `check-${index}`, nextCheckAt: `2026-11-0${index + 1}T00:00:00.000Z` }))
	], now, 4);

	assert.equal(ordered.length, 4);
	assert.ok(ordered.every(entry => entry.check.id !== "bad"));
});
