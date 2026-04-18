import type { NationwideLookupResultContext } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { buildDistrictRepresentativeAvailabilityNote } from "../src/utils/district-availability.ts";
import { buildDistrictCandidateSummaryHref, buildDistrictRepresentativeSummaryHref } from "../src/utils/district-page-links.ts";
import { buildNationwideDistrictPageRecord } from "../src/utils/district-page.ts";

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
		coverageLabel: "Nationwide civic results available",
		displayName: "Provo, Utah",
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: false,
		slug: "provo-utah",
		state: "Utah"
	},
	normalizedAddress: "84604",
	note: "Nationwide civic results ready.",
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
	assert.match(districtPage.candidateAvailabilityNote, /published local guide/i);
	assert.match(districtPage.districtOriginNote, /ZIP-based nationwide lookup/i);
	assert.ok(districtPage.sources.some(source => /Open States|U\.S\. Census Geocoder/.test(source.publisher)));
});

test("nationwide district fallback is honest about missing city officeholder pipelines", () => {
	const districtPage = buildNationwideDistrictPageRecord(nationwideLookupResult, "provo-city");

	assert.ok(districtPage);
	assert.equal(districtPage.representatives.length, 0);
	assert.match(districtPage.representativeAvailabilityNote, /City officeholder data is not yet available/i);
	assert.match(buildDistrictRepresentativeAvailabilityNote(districtPage.district, 0), /City officeholder data is not yet available/i);
});

test("district summary cards only link when candidate or representative data exists", () => {
	assert.equal(buildDistrictCandidateSummaryHref([]), undefined);
	assert.equal(buildDistrictCandidateSummaryHref([{ slug: "jane-doe" }]), "/candidate/jane-doe");
	assert.equal(buildDistrictCandidateSummaryHref([{ slug: "jane-doe" }, { slug: "john-smith" }]), "#candidates");

	assert.equal(buildDistrictRepresentativeSummaryHref([]), undefined);
	assert.equal(buildDistrictRepresentativeSummaryHref([{ href: "/representatives/john-curtis" }]), "/representatives/john-curtis");
	assert.equal(buildDistrictRepresentativeSummaryHref([{ href: "/representatives/john-curtis" }, { href: "/representatives/mike-lee" }]), "#representatives");
});
