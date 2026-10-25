import type { NationwideLookupResultContext } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { buildDistrictRepresentativeAvailabilityNote, buildDistrictRepresentativeCountLabel } from "../src/utils/district-availability.ts";
import { buildDistrictCandidateSummaryHref, buildDistrictRepresentativeSummaryHref } from "../src/utils/district-page-links.ts";
import { buildNationwideDistrictPageRecord } from "../src/utils/district-page.ts";
import { buildNationwideDirectoryResponses } from "../src/utils/nationwide-directory.ts";

const nationwideLookupResult = {
	actions: [
		{
			badge: "Official",
			description: "Official Utah voter portal for registration status, address updates, polling location lookup, and related voter tools.",
			id: "utah-voter-portal",
			kind: "official-verification",
			title: "Utah voter registration portal",
			url: "https://vote.utah.gov/"
		}
	],
	availability: null,
	detectedFromIp: false,
	districtMatches: [
		{
			districtCode: "03",
			districtType: "Congressional District",
			id: "ut-cd-03",
			label: "Congressional District 3",
			sourceSystem: "U.S. Census Geocoder"
		},
		{
			districtCode: "24",
			districtType: "State Senate District",
			id: "ut-senate-24",
			label: "State Senate District 24",
			sourceSystem: "U.S. Census Geocoder"
		},
		{
			districtCode: "84604",
			districtType: "Provo city",
			id: "provo-city",
			label: "Provo city",
			sourceSystem: "U.S. Census Geocoder"
		}
	],
	election: null,
	electionSlug: undefined,
	fromCache: false,
	guideAvailability: "not-published" as const,
	inputKind: "zip",
	location: {
		coverageLabel: "Civic results available",
		displayName: "Provo, Utah",
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: false,
		slug: "provo-utah",
		state: "Utah"
	},
	normalizedAddress: "84604",
	note: "Civic results ready.",
	representativeMatches: [
		{
			districtLabel: "Representative UT-3",
			id: "ocd-person:ut-cd-3",
			name: "Mike Kennedy",
			officeTitle: "Representative",
			openstatesUrl: "https://openstates.org/person/mike-kennedy/",
			party: "Republican",
			sourceSystem: "Open States"
		},
		{
			districtLabel: "Senator 24",
			id: "ocd-person:ut-sen-24",
			name: "Keven Stratton",
			officeTitle: "Senator",
			openstatesUrl: "https://openstates.org/person/keven-stratton/",
			party: "Republican",
			sourceSystem: "Open States"
		}
	],
	resolvedAt: "2026-04-18T12:43:00.000Z",
	result: "resolved" as const,
	selectionOptions: []
} satisfies NationwideLookupResultContext;

test("nationwide district fallback builds a usable detail page for routed district cards", () => {
	const districtPage = buildNationwideDistrictPageRecord(nationwideLookupResult, "ut-cd-03");

	assert.ok(districtPage);
	assert.equal(districtPage.mode, "nationwide");
	assert.equal(districtPage.district.title, "Congressional District 3");
	assert.equal(districtPage.representatives.length, 1);
	assert.equal(districtPage.representatives[0]?.href, "/representatives/mike-kennedy");
	assert.equal(districtPage.officialResources.length, 1);
	assert.match(districtPage.candidateAvailabilityNote, /Candidate information is not available/i);
	assert.match(districtPage.districtOriginNote, /this ZIP result/i);
	assert.doesNotMatch(JSON.stringify(districtPage), /current ZIP lookup|saved lookup/i);
	assert.ok(districtPage.sources.some(source => /Open States|U\.S\. Census Geocoder/.test(source.publisher)));
});

test("nationwide district fallback is honest about missing city officeholder data", () => {
	const districtPage = buildNationwideDistrictPageRecord(nationwideLookupResult, "provo-city");

	assert.ok(districtPage);
	assert.equal(districtPage.representatives.length, 0);
	assert.equal(buildDistrictRepresentativeCountLabel(districtPage.district, 0), "Local officials not attached yet");
	assert.match(districtPage.representativeAvailabilityNote, /No city officeholder data is attached here yet/i);
	assert.match(buildDistrictRepresentativeAvailabilityNote(districtPage.district, 0), /No city officeholder data is attached here yet/i);
});

test("a county coverage gap does not hide officials belonging to other districts", () => {
	const context = {
		...nationwideLookupResult,
		districtMatches: [...nationwideLookupResult.districtMatches, { id: "county-033", districtType: "County", districtCode: "033", label: "County 033", sourceSystem: "U.S. Census Geocoder" }],
	};
	const county = buildNationwideDistrictPageRecord(context, "county-033");
	const directory = buildNationwideDirectoryResponses(context).representatives;
	assert.ok(county);
	assert.deepEqual(county.representatives, []);
	assert.ok(directory.representatives.length > 0);
	assert.ok(directory.representatives.every(representative => representative.districtSlug !== county.district.slug));
});

test("district summary cards only link when candidate or representative data exists", () => {
	assert.equal(buildDistrictCandidateSummaryHref([]), undefined);
	assert.equal(buildDistrictCandidateSummaryHref([{ slug: "jane-doe" }]), "/candidate/jane-doe");
	assert.equal(buildDistrictCandidateSummaryHref([{ slug: "jane-doe" }, { slug: "john-smith" }]), "#candidates");

	assert.equal(buildDistrictRepresentativeSummaryHref([]), undefined);
	assert.equal(buildDistrictRepresentativeSummaryHref([{ href: "/representatives/john-curtis" }]), "/representatives/john-curtis");
	assert.equal(buildDistrictRepresentativeSummaryHref([{ href: "/representatives/john-curtis" }, { href: "/representatives/mike-lee" }]), "#representatives");
});
