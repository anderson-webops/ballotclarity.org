import type { NationwideLookupResultContext } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { buildNationwidePersonProfileResponse } from "../src/utils/nationwide-person-profile.ts";

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
		}
	],
	resolvedAt: "2026-04-18T12:43:00.000Z",
	result: "resolved" as const,
	selectionOptions: []
} satisfies NationwideLookupResultContext;

test("nationwide representative fallback builds a first-class person page model", () => {
	const response = buildNationwidePersonProfileResponse(nationwideLookupResult, "ocd-person-ut-cd-3");

	assert.ok(response);
	assert.equal(response.updatedAt, "2026-04-18T12:43:00.000Z");
	assert.equal(response.person.name, "Mike Kennedy");
	assert.equal(response.person.openstatesUrl, "https://openstates.org/person/mike-kennedy/");
	assert.equal(response.person.funding, null);
	assert.equal(response.person.onCurrentBallot, false);
	assert.equal(response.person.officeholderLabel, "Current officeholder");
	assert.match(response.note, /active nationwide lookup context/i);
	assert.match(response.person.whatWeDoNotKnow[0]?.text ?? "", /published local guide/i);
	assert.ok(response.person.sources.length >= 2);
});
