import assert from "node:assert/strict";
import test from "node:test";
import { classifyDistrictLevel } from "../src/utils/district-level.ts";

test("state legislative districts are never classified as federal", () => {
	assert.equal(classifyDistrictLevel({ districtType: "state-senate", label: "State Senate District 36" }).label, "State");
	assert.equal(classifyDistrictLevel({ districtType: "state-house", label: "State House District 59" }).label, "State");
});

test("districts order from federal to local", () => {
	const levels = [
		{ districtType: "place", label: "Atlanta city" },
		{ districtType: "county", label: "Fulton County" },
		{ districtType: "state-senate", label: "State Senate District 36" },
		{ districtType: "congressional", label: "Congressional District 5" }
	].map(classifyDistrictLevel);

	assert.deepEqual(levels.map(level => level.label), ["City or local", "County", "State", "Federal"]);
	assert.deepEqual([...levels].sort((left, right) => left.order - right.order).map(level => level.label), ["Federal", "State", "County", "City or local"]);
});
