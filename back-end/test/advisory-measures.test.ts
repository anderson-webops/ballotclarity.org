import assert from "node:assert/strict";
import test from "node:test";
import { buildSeedCoverageSnapshot, isSupportedMeasureDecisionEffect, parseCoverageSnapshot } from "../src/coverage-repository.js";

test("advisory metadata requires explicit supported binary choices without asserting other measures are binding", () => {
	assert.equal(isSupportedMeasureDecisionEffect(undefined, undefined), true);
	assert.equal(isSupportedMeasureDecisionEffect("advisory", { yes: "Yes", no: "No" }), true);
	for (const value of [null, true, false, "", "binding", "unknown"])
		assert.equal(isSupportedMeasureDecisionEffect(value, { yes: "Yes", no: "No" }), false);
	for (const options of [undefined, null, {}, { yes: "A", no: "B" }, { yes: "Yes", no: "No", third: "Neither" }])
		assert.equal(isSupportedMeasureDecisionEffect("advisory", options), false);
});

test("root and nested advisory metadata survives coverage loading and cannot fall back to inferred vote labels", () => {
	for (const nested of [false, true]) {
		const snapshot = structuredClone(buildSeedCoverageSnapshot());
		const measure = nested ? snapshot.election!.contests.flatMap(contest => contest.measures ?? [])[0]! : snapshot.measures[0]!;
		measure.decisionEffect = "advisory";
		measure.ballotOptions = { yes: "Yes", no: "No" };
		assert.equal(parseCoverageSnapshot(snapshot), snapshot);
		delete measure.ballotOptions;
		assert.throws(() => parseCoverageSnapshot(snapshot), /Advisory decisions require explicit/u);
	}
});
