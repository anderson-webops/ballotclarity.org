import type { NationwideLookupResultContext } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { buildNationwideDirectoryResponses } from "../src/utils/nationwide-directory.ts";

const nationwideLookupResult = {
	actions: [],
	availability: null,
	detectedFromIp: false,
	districtMatches: [
		{
			districtCode: "03",
			districtType: "Congressional District",
			id: "ut-cd-03",
			label: "Congressional District 3",
			sourceSystem: "Census"
		},
		{
			districtCode: "24",
			districtType: "State Senate District",
			id: "ut-senate-24",
			label: "State Senate District 24",
			sourceSystem: "Census"
		},
		{
			districtCode: "60",
			districtType: "State House District",
			id: "ut-house-60",
			label: "State House District 60",
			sourceSystem: "Census"
		}
	],
	election: null,
	electionSlug: "2026-utah-county-general",
	fromCache: false,
	guideAvailability: "not-published" as const,
	inputKind: "zip",
	lookupQuery: "84604",
	location: {
		coverageLabel: "Nationwide civic results available",
		displayName: "Provo, Utah",
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: false,
		slug: "provo-utah",
		state: "Utah"
	},
	normalizedAddress: "84604",
	note: "Nationwide lookup for Provo, Utah.",
	representativeMatches: [
		{
			districtLabel: "Congressional District 3",
			id: "ocd-person:ut-cd-3",
			name: "John Curtis",
			officeTitle: "Representative",
			openstatesUrl: "https://openstates.org/ocd-person/ut-cd-3",
			party: "Republican",
			sourceSystem: "Open States"
		},
		{
			districtLabel: "State Senate District 24",
			id: "ocd-person:ut-sen-24",
			name: "Keven Stratton",
			officeTitle: "Senator",
			party: "Republican",
			sourceSystem: "Open States"
		}
	],
	result: "resolved",
	selectionOptions: []
} satisfies Omit<NationwideLookupResultContext, "election" | "location">;

const publishedGuideLookupResult = {
	...nationwideLookupResult,
	result: "resolved",
	guideAvailability: "published" as const,
	availability: null
} satisfies NationwideLookupResultContext;

test("nationwide directory derivation uses district matches and representative matches", () => {
	const bundle = buildNationwideDirectoryResponses(nationwideLookupResult);

	assert.equal(bundle.districts.districts.length, 3);
	assert.equal(bundle.representatives.representatives.length, 2);
	assert.equal(bundle.representatives.representatives[0].districtLabel, "Congressional District 3");
	assert.equal(bundle.representatives.representatives[1].districtSlug, "ut-senate-24");
	assert.equal(bundle.districts.districts.find(district => district.slug === "ut-cd-03")?.representativeCount, 1);
	assert.equal(bundle.districts.districts.find(district => district.slug === "ut-senate-24")?.representativeCount, 1);
	assert.equal(bundle.districts.districts.find(district => district.slug === "ut-house-60")?.representativeCount, 0);
});

test("published guide context should keep guide directory behavior external to nationwide derivation", () => {
	assert.equal(publishedGuideLookupResult.guideAvailability, "published");
	assert.equal(buildNationwideDirectoryResponses(publishedGuideLookupResult).representatives.representatives.length, 2);
	assert.equal(buildNationwideDirectoryResponses(publishedGuideLookupResult).districts.districts.length, 3);
});
