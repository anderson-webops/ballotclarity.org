import assert from "node:assert/strict";
import test from "node:test";
import { classifyRepresentative } from "../src/representative-classification.js";

test("countywide agency roles retain their sourced identity", () => {
	for (const officeTitle of ["Sheriff", "District Attorney"]) assert.equal(classifyRepresentative({ officeTitle, districtLabel: "Fulton County", districtType: "county", stateCode: "GA" }).officeDisplayLabel, `Fulton County ${officeTitle}`);
});

test("county commission members retain their distinct sourced roles and district numbers", () => {
	for (const [officeTitle, districtLabel, expected] of [["County Commission Chair", "Fulton County", "Fulton County Commission Chair"], ["County Commissioner, District 1", "Fulton County Commission District 1", "Fulton County Commissioner, District 1"], ["County Commission Vice Chair, District 6", "Fulton County Commission District 6", "Fulton County Commission Vice Chair, District 6"]]) {
		assert.equal(classifyRepresentative({ officeTitle, districtLabel, districtType: "county-commission", stateCode: "GA" }).officeDisplayLabel, expected);
	}
});

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
