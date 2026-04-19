import assert from "node:assert/strict";
import test from "node:test";
import { buildResultsSummaryItems } from "../src/utils/results-summary.ts";

test("results summary cards keep lookup-aware links for district and representative routes", () => {
	const items = buildResultsSummaryItems(
		{
			districtMatches: [
				{ districtCode: "7", districtType: "congressional", id: "district:congressional-7", label: "Congressional District 7", sourceSystem: "U.S. Census Geocoder" }
			],
			guideAvailability: "not-published",
			lookupQuery: "30022",
			representativeMatches: [
				{
					districtLabel: "Representative GA-7",
					governmentLevel: "federal",
					id: "rich-mccormick",
					name: "Rich McCormick",
					officeDisplayLabel: "U.S. Representative for Georgia's 7th Congressional District",
					officeTitle: "Representative",
					officeType: "us_house",
					party: "Republican",
					sourceSystem: "Open States"
				}
			],
			selectionId: "zip:30022:alpharetta-georgia"
		},
		1,
		null
	);

	assert.equal(items[0]?.href, "/districts?lookup=30022&selection=zip%3A30022%3Aalpharetta-georgia");
	assert.equal(items[1]?.href, "/representatives?lookup=30022&selection=zip%3A30022%3Aalpharetta-georgia");
	assert.equal(items[2]?.href, undefined);
	assert.equal(items[3]?.href, undefined);
});

test("results summary cards still fall back to route roots without an active lookup context", () => {
	const items = buildResultsSummaryItems(null, 0, null);

	assert.equal(items[0]?.href, "/districts");
	assert.equal(items[1]?.href, "/representatives");
	assert.equal(items[3]?.value, "Not published");
});
