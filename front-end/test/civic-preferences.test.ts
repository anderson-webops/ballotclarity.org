import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStoredBallotPlan, normalizeStoredStrings } from "../src/utils/civic-preferences.ts";

test("saved preference lists discard corrupt entries and retain unique trimmed choices", () => {
	for (const input of [null, undefined, 42, false, {}, "district"])
		assert.deepEqual(normalizeStoredStrings(input), []);
	assert.deepEqual(normalizeStoredStrings([null, 42, " healthcare ", "", "healthcare", "schools"]), ["healthcare", "schools"]);
});

test("valid ballot choices survive preference recovery", () => {
	const plan = {
		house: { candidateSlug: "candidate-a", contestSlug: "house", savedAt: "2026-09-10T12:00:00Z", type: "candidate" },
		parks: { contestSlug: "parks", decision: "review", measureSlug: "measure-a", savedAt: "2026-09-10T12:00:00Z", type: "measure" }
	};
	assert.deepEqual(normalizeStoredBallotPlan(plan), plan);
});

test("corrupt ballot entries cannot break the plan or move a choice to another contest", () => {
	for (const input of [null, false, [], 42, "plan"])
		assert.deepEqual(normalizeStoredBallotPlan(input), {});
	assert.deepEqual(normalizeStoredBallotPlan({
		missing: null,
		wrongContest: { candidateSlug: "a", contestSlug: "another", savedAt: "2026-09-10", type: "candidate" },
		wrongDate: { candidateSlug: "a", contestSlug: "wrongDate", savedAt: "bad-date", type: "candidate" },
		wrongDecision: { contestSlug: "wrongDecision", decision: "invalid", measureSlug: "m", savedAt: "2026-09-10", type: "measure" }
	}), {});
});
