import assert from "node:assert/strict";
import test from "node:test";
import { referenceJurisdiction } from "../src/utils/reference-context.ts";

test("reference context omits district labels already present in the office title", () => {
	for (const office of ["State Senate District 6", "State House - District 6", "State Assembly, DISTRICT 6", "District 6"]) {
		assert.equal(referenceJurisdiction({ office, jurisdiction: "District 6" }), undefined);
	}
	assert.equal(referenceJurisdiction({ office: "State Senate   District 6 ", jurisdiction: " District 6 " }), undefined);
});

test("reference context preserves independent districts and meaningful place names", () => {
	assert.equal(referenceJurisdiction({ office: "State Senator", jurisdiction: "District 6" }), "District 6");
	assert.equal(referenceJurisdiction({ office: "State Senate District 60", jurisdiction: "District 6" }), "District 6");
	assert.equal(referenceJurisdiction({ office: "State Senate OtherDistrict 6", jurisdiction: "District 6" }), "District 6");
	assert.equal(referenceJurisdiction({ office: "School Board", jurisdiction: "Example County" }), "Example County");
	assert.equal(referenceJurisdiction({ office: "Governor" }), undefined);
});

test("qualifying parentheses do not repeat a district or erase a distinct district", () => {
	for (const office of ["State Senate District 1 (Multi-County)", "State Senate District 1 (Multi-County) (Special Election)"])
		assert.equal(referenceJurisdiction({ office, jurisdiction: "District 1" }), undefined);
	assert.equal(referenceJurisdiction({ office: "State Senate District 10 (Multi-County)", jurisdiction: "District 1" }), "District 1");
	assert.equal(referenceJurisdiction({ office: "State Senate OtherDistrict 1 (Multi-County)", jurisdiction: "District 1" }), "District 1");
	assert.equal(referenceJurisdiction({ office: "State Senate District 10 (District 1)", jurisdiction: "District 1" }), "District 1");
});
