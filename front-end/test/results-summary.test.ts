import assert from "node:assert/strict";
import test from "node:test";
import { buildResultsSummaryItems, limitedBallotNotice } from "../src/utils/results-summary.ts";

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

test("results summary cards still fall back to route roots without a selected area result", () => {
	const items = buildResultsSummaryItems(null, 0, null);

	assert.equal(items[0]?.href, "/districts");
	assert.equal(items[1]?.href, "/representatives");
	assert.equal(items[3]?.value, "Not published");
});

test("an unverified published overview describes limited information rather than an editorial review", () => {
	const items = buildResultsSummaryItems({ districtMatches: [], guideAvailability: "published", lookupQuery: "30022", representativeMatches: [] }, 1);
	assert.equal(limitedBallotNotice, "Ballot information for your area is currently limited.");
	assert.equal(items[3]?.note, limitedBallotNotice);
	assert.equal(items[3]?.value, "Limited");
});

test("verified ballot information does not receive a limited-information status", () => {
	const layer = { count: 1, detail: "Reviewed record", hasContent: true, label: "Reviewed", status: "verified_local" as const };
	const items = buildResultsSummaryItems({
		districtMatches: [],
		guideAvailability: "published",
		guideContent: { candidates: layer, contests: layer, guideShell: layer, measures: layer, mixedContent: false, officialLogistics: layer, publishedGuideShell: true, summary: "Reviewed guide", verifiedContestPackage: true },
		lookupQuery: "30022",
		representativeMatches: []
	}, 1);
	assert.equal(items[3]?.value, "Verified");
	assert.notEqual(items[3]?.note, limitedBallotNotice);
});
