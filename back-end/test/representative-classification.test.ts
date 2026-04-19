import assert from "node:assert/strict";
import test from "node:test";
import { classifyRepresentative } from "../src/representative-classification.js";

test("classifyRepresentative derives a federal senate state from provider-style district labels", () => {
	assert.deepEqual(classifyRepresentative({
		districtLabel: "Senator Georgia",
		officeTitle: "Senator",
		stateName: "United States",
	}), {
		governmentLevel: "federal",
		officeDisplayLabel: "U.S. Senator for Georgia",
		officeType: "us_senate",
	});
});

test("classifyRepresentative derives a federal house state from provider-style district codes", () => {
	assert.deepEqual(classifyRepresentative({
		districtLabel: "Representative GA-7",
		officeTitle: "Representative",
		stateName: "United States",
	}), {
		governmentLevel: "federal",
		officeDisplayLabel: "U.S. Representative for Georgia's 7th Congressional District",
		officeType: "us_house",
	});
});
