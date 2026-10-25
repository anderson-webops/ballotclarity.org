import type { NationwideLookupResultContext, RepresentativesResponse } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { buildNationwideDirectoryResponses, mergeNationwideDirectoryResponses } from "../src/utils/nationwide-directory.ts";

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
		coverageLabel: "Civic results available",
		displayName: "Provo, Utah",
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: false,
		slug: "provo-utah",
		state: "Utah"
	},
	normalizedAddress: "84604",
	note: "Lookup results for Provo, Utah.",
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

test("directory merges preserve supplied portraits and websites when an API summary omits them", () => {
	const context = structuredClone(nationwideLookupResult) as NationwideLookupResultContext;
	const match = context.representativeMatches[0]!;
	match.officialWebsiteUrl = "https://example.org/office";
	match.profileImages = [{ url: "https://example.org/portrait.jpg", alt: match.name, priority: 10, sourceKind: "official", sourceLabel: "Official office", sourceSystem: "Official office" }];
	const stored = buildNationwideDirectoryResponses(context);
	const representative = stored.representatives.representatives[0]!;
	assert.equal(representative.officialWebsiteUrl, match.officialWebsiteUrl);
	const merged = mergeNationwideDirectoryResponses(stored, { representatives: { ...stored.representatives, representatives: [{ ...representative, officialWebsiteUrl: undefined, profileImages: undefined }] } });
	assert.equal(merged.representatives.representatives[0]?.officialWebsiteUrl, match.officialWebsiteUrl);
	assert.deepEqual(merged.representatives.representatives[0]?.profileImages, match.profileImages);
});

test("nationwide directory derivation uses district matches and representative matches", () => {
	const bundle = buildNationwideDirectoryResponses(nationwideLookupResult);

	assert.equal(bundle.districts.districts.length, 3);
	assert.equal(bundle.representatives.representatives.length, 2);
	assert.equal(bundle.representatives.representatives[0].districtLabel, "Congressional District 3");
	assert.equal(bundle.representatives.representatives[0].governmentLevel, "federal");
	assert.equal(bundle.representatives.representatives[0].location, "Provo, Utah");
	assert.equal(bundle.representatives.representatives[0].officeDisplayLabel, "U.S. Representative for Utah's 3rd Congressional District");
	assert.equal(bundle.representatives.representatives[0].href, "/representatives/john-curtis");
	assert.equal(bundle.representatives.representatives[0].officeholderLabel, "Current officeholder");
	assert.equal(bundle.representatives.representatives[0].officeType, "us_house");
	assert.equal(bundle.representatives.representatives[0].onCurrentBallot, false);
	assert.equal(bundle.representatives.representatives[0].ballotStatusLabel, "Published ballot status unavailable in this area");
	assert.equal(bundle.representatives.representatives[0].fundingAvailable, false);
	assert.equal(bundle.representatives.representatives[0].fundingSummary, "No person-level funding record is attached to this representative yet.");
	assert.equal(bundle.representatives.representatives[0].influenceAvailable, false);
	assert.equal(bundle.representatives.representatives[0].influenceSummary, "No person-level influence record is attached to this representative yet.");
	assert.equal(bundle.representatives.representatives[0].openstatesUrl, "https://openstates.org/ocd-person/ut-cd-3");
	assert.equal(bundle.representatives.representatives[0].provenance?.status, "crosswalked");
	assert.equal(bundle.representatives.representatives[0].sources.length, 1);
	assert.equal(bundle.representatives.representatives[0].sources[0]?.publisher, "Open States");
	assert.equal(bundle.representatives.representatives[0].summary, "");
	assert.equal(bundle.representatives.representatives[1].summary, "");
	assert.equal(bundle.representatives.representatives[1].sources.length, 0);
	assert.equal(bundle.representatives.representatives[1].districtSlug, "ut-senate-24");
	assert.equal(bundle.representatives.representatives[1].governmentLevel, "state");
	assert.equal(bundle.representatives.representatives[1].officeType, "state_senate");
	assert.equal(bundle.representatives.representatives[1].officeDisplayLabel, "Utah State Senator for District 24");
	assert.equal(bundle.districts.districts.find(district => district.slug === "ut-cd-03")?.representativeCount, 1);
	assert.equal(bundle.districts.districts.find(district => district.slug === "ut-senate-24")?.representativeCount, 1);
	assert.equal(bundle.districts.districts.find(district => district.slug === "ut-house-60")?.representativeCount, 0);
});

test("published guide context should keep guide directory behavior external to nationwide derivation", () => {
	assert.equal(publishedGuideLookupResult.guideAvailability, "published");
	assert.equal(buildNationwideDirectoryResponses(publishedGuideLookupResult).representatives.representatives.length, 2);
	assert.equal(buildNationwideDirectoryResponses(publishedGuideLookupResult).districts.districts.length, 3);
});

test("nationwide directory merging keeps saved provider officials and reviewed API enrichment", () => {
	const stored = buildNationwideDirectoryResponses(nationwideLookupResult);
	const apiKeven = {
		...stored.representatives.representatives[1],
		sourceCount: 2,
		summary: "Current reviewed API record"
	};
	const apiMarsha = {
		...apiKeven,
		districtLabel: "Provo city",
		districtSlug: "state-house-60",
		href: "/representatives/marsha-judkins",
		name: "Marsha Judkins",
		slug: "marsha-judkins"
	};
	const apiDistricts = stored.representatives.districts.map((district) => {
		if (district.slug === "ut-cd-03")
			return { ...district, href: "/districts/congressional-3", slug: "congressional-3" };

		if (district.slug === "ut-house-60")
			return { ...district, href: "/districts/state-house-60", slug: "state-house-60" };

		return district;
	});
	const apiRepresentatives = {
		...stored.representatives,
		districts: apiDistricts,
		representatives: [apiKeven, apiMarsha],
		updatedAt: "2099-07-30T00:00:00.000Z"
	} satisfies RepresentativesResponse;
	const merged = mergeNationwideDirectoryResponses(stored, {
		representatives: apiRepresentatives
	});

	assert.equal(merged.representatives.representatives.length, 3);
	assert.ok(merged.representatives.representatives.some(representative => representative.slug === "john-curtis"));
	assert.equal(
		merged.representatives.representatives.find(representative => representative.slug === "keven-stratton")?.summary,
		"Current reviewed API record"
	);
	assert.ok(merged.representatives.representatives.some(representative => representative.slug === "marsha-judkins"));
	assert.equal(merged.districts.districts.length, 3);
	assert.equal(
		merged.representatives.representatives.find(representative => representative.slug === "john-curtis")?.districtSlug,
		"congressional-3"
	);
	assert.equal(merged.districts.districts.find(district => district.slug === "state-house-60")?.representativeCount, 1);
	assert.equal(merged.representatives.updatedAt, "2099-07-30T00:00:00.000Z");
});

test("nationwide directory canonical matching links mismatched provider labels to the same districts", () => {
	const bundle = buildNationwideDirectoryResponses({
		...nationwideLookupResult,
		representativeMatches: [
			{
				districtLabel: "Representative UT-3",
				id: "ocd-person:ut-cd-3",
				name: "Mike Kennedy",
				officeTitle: "Representative",
				party: "Republican",
				sourceSystem: "Open States"
			},
			{
				districtLabel: "Senator 24",
				id: "ocd-person:ut-sen-24",
				name: "Keven Stratton",
				officeTitle: "Senator",
				party: "Republican",
				sourceSystem: "Open States"
			},
			{
				districtLabel: "Representative 60",
				id: "ocd-person:ut-house-60",
				name: "Tyler Clancy",
				officeTitle: "Representative",
				party: "Republican",
				sourceSystem: "Open States"
			}
		]
	});

	assert.equal(bundle.representatives.representatives.find(representative => representative.name === "Mike Kennedy")?.districtSlug, "ut-cd-03");
	assert.equal(bundle.representatives.representatives.find(representative => representative.name === "Mike Kennedy")?.officeType, "us_house");
	assert.equal(bundle.representatives.representatives.find(representative => representative.name === "Keven Stratton")?.districtSlug, "ut-senate-24");
	assert.equal(bundle.representatives.representatives.find(representative => representative.name === "Keven Stratton")?.officeType, "state_senate");
	assert.equal(bundle.representatives.representatives.find(representative => representative.name === "Tyler Clancy")?.districtSlug, "ut-house-60");
	assert.equal(bundle.representatives.representatives.find(representative => representative.name === "Tyler Clancy")?.officeType, "state_house");
	assert.equal(bundle.districts.districts.find(district => district.slug === "ut-cd-03")?.representativeCount, 1);
	assert.equal(bundle.districts.districts.find(district => district.slug === "ut-senate-24")?.representativeCount, 1);
	assert.equal(bundle.districts.districts.find(district => district.slug === "ut-house-60")?.representativeCount, 1);
});

test("directory merging deduplicates opaque provider district identifiers", () => {
	const stored = buildNationwideDirectoryResponses({
		...nationwideLookupResult,
		districtMatches: [{ id: "opaque-provider-district", districtType: "state-house", districtCode: "1", label: "House District 1", sourceSystem: "Isolated fixture" }],
		representativeMatches: []
	});
	const district = stored.districts.districts[0]!;
	const merged = mergeNationwideDirectoryResponses(stored, {
		districts: { ...stored.districts, districts: [{ ...district, slug: "state-house-1", href: "/districts/state-house-1" }] }
	});
	assert.equal(merged.districts.districts.length, 1);
	assert.equal(merged.districts.districts[0]?.slug, "state-house-1");
});

test("directory label aliases do not merge different chambers", () => {
	const stored = buildNationwideDirectoryResponses({
		...nationwideLookupResult,
		districtMatches: [
			{ id: "opaque-house", districtType: "state-house", districtCode: "1", label: "District 1", sourceSystem: "Isolated fixture" },
			{ id: "opaque-senate", districtType: "state-senate", districtCode: "1", label: "District 1", sourceSystem: "Isolated fixture" }
		],
		representativeMatches: []
	});
	assert.equal(mergeNationwideDirectoryResponses(stored, { districts: stored.districts }).districts.districts.length, 2);
});
