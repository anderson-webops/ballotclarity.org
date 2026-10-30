import assert from "node:assert/strict";
import test from "node:test";
import { demoElection } from "../src/coverage-data.js";
import { reviewedElectionDates } from "../src/reviewed-election-dates.js";

test("the exact reviewed legacy Fulton deadline is corrected without mutating retained evidence", () => {
	const legacy = structuredClone(demoElection);
	const deadline = legacy.keyDates.find(entry => entry.label === "Election Day polls close")!;
	deadline.date = "2026-11-03T19:00:00.000Z";
	const corrected = reviewedElectionDates(legacy);
	assert.equal(corrected.timeZone, "America/New_York");
	assert.equal(corrected.keyDates.find(entry => entry.label === deadline.label)?.date, "2026-11-04T00:00:00.000Z");
	assert.equal(deadline.date, "2026-11-03T19:00:00.000Z");
	assert.deepEqual(reviewedElectionDates(corrected), corrected);
});

test("date corrections do not alter other elections, changed evidence or legitimate UTC times", () => {
	for (const change of [{ slug: "another-election" }, { date: "2028-11-07" }]) {
		const other = { ...demoElection, ...change };
		assert.equal(reviewedElectionDates(other), other);
	}
	const changed = { ...demoElection, keyDates: [{ label: "Election Day polls close", date: "2026-11-03T19:00:00.000Z", note: "Different reviewed closing hours." }] };
	assert.equal(reviewedElectionDates(changed).keyDates[0]?.date, changed.keyDates[0]?.date);
});
