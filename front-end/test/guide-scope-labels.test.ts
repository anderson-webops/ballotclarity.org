import assert from "node:assert/strict";
import test from "node:test";
import { fullAreaGuideLabels } from "../src/utils/guide-scope";

test("D.C. guide scope uses districtwide wording with either supported state identity", () => {
	for (const state of ["DC", "District of Columbia"])
		assert.deepEqual(fullAreaGuideLabels(state), { status: "Districtwide information only", limitation: "Candidate races are not included." });
});

test("state guide labels remain unchanged outside D.C.", () => {
	for (const state of [undefined, "", "AK", "Alaska", "VA", "Virginia", "Washington"])
		assert.deepEqual(fullAreaGuideLabels(state), { status: "Statewide information only", limitation: "Local races are not included." });
});
