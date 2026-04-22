import type { ElectionSummary, LocationLookupResponse } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
	buildHomeExperienceState,
	deriveCivicLookupStateUpdate,
	resolveLookupDestination
} from "../src/utils/nationwide-results.ts";

const stagedGuideContent = {
	candidates: {
		count: 5,
		detail: "Candidate records still rely on staged reference material instead of verified local content.",
		hasContent: true,
		label: "Candidates",
		status: "staged_reference" as const,
	},
	contests: {
		count: 4,
		detail: "Contest records still rely on staged reference material instead of verified local content.",
		hasContent: true,
		label: "Contests",
		status: "staged_reference" as const,
	},
	guideShell: {
		count: 1,
		detail: "This local guide is published with verified official election links, but the contest pages still need local review.",
		hasContent: true,
		label: "Local guide",
		status: "official_logistics_only" as const,
	},
	mixedContent: true,
	measures: {
		count: 2,
		detail: "Measure records still rely on staged reference material instead of verified local content.",
		hasContent: true,
		label: "Measures",
		status: "staged_reference" as const,
	},
	officialLogistics: {
		count: 3,
		detail: "Official county and statewide election logistics are attached from current official sources.",
		hasContent: true,
		label: "Official logistics",
		status: "verified_local" as const,
	},
	publishedGuideShell: true,
	summary: "This published local guide includes verified official election links, but some contest, candidate, or measure pages are still under local review.",
	verifiedContestPackage: false,
};

const activeElection: ElectionSummary = {
	date: "2026-11-03",
	jurisdictionSlug: "utah-county-utah",
	locationName: "Utah County, Utah",
	name: "2026 Utah County General Election",
	slug: "2026-utah-county-general",
	updatedAt: "2026-04-18T00:00:00.000Z"
};

const nationwideResponse: LocationLookupResponse = {
	actions: [
		{
			description: "Official Utah voter portal for registration status, address updates, polling location lookup, and related voter tools.",
			id: "utah-voter-portal",
			kind: "official-verification",
			title: "Utah voter registration portal",
			url: "https://vote.utah.gov"
		}
	],
	availability: {
		ballotCandidates: {
			detail: "Ballot candidate pages are not published for this area yet.",
			label: "Ballot candidate data",
			status: "unavailable"
		},
		financeInfluence: {
			detail: "No person-level funding or influence records are attached to this lookup yet. Ballot Clarity only shows those modules when a matched candidate or representative profile has reliable linked data.",
			label: "Finance and influence",
			status: "unavailable"
		},
		guideShell: {
			detail: "No local guide is published for this area yet.",
			label: "Local guide",
			status: "unavailable"
		},
		fullLocalGuide: {
			detail: "A full local contest and measure guide is not published for this area yet.",
			label: "Local guide coverage",
			status: "unavailable"
		},
		nationwideCivicResults: {
			detail: "Civic results and official election tools are available for this ZIP lookup even though a published local guide is not available for this area yet.",
			label: "Civic results for your area",
			status: "available"
		},
		officialLogistics: {
			detail: "Official election logistics or verification tools are attached for this lookup.",
			label: "Official logistics",
			status: "available"
		},
		representatives: {
			detail: "Current representative data is available for this lookup from Open States (1 match).",
			label: "Representative data",
			status: "available"
		},
		verifiedContestPackage: {
			detail: "No verified local contest pages are published for this area yet.",
			label: "Verified contest pages",
			status: "unavailable"
		}
	},
	districtMatches: [
		{
			districtCode: "03",
			districtType: "congressional",
			id: "ut-cd-03",
			label: "Utah Congressional District 3",
			sourceSystem: "OpenStates"
		}
	],
	guideAvailability: "not-published",
	inputKind: "zip",
	electionLogistics: {
		additionalElectionNames: ["2026 Atlanta Runoff Election"],
		dropOffLocations: [
			{
				address: "125 Central Ave SW, Atlanta, GA 30303",
				id: "dropoff-1",
				name: "Fulton County Election Hub",
			},
		],
		earlyVoteSites: [
			{
				address: "560 Amsterdam Ave NE, Atlanta, GA 30306",
				id: "early-1",
				name: "Atlanta Early Vote Center",
			},
		],
		electionDay: "2026-11-03",
		electionName: "2026 Georgia General Election",
		mailOnly: false,
		normalizedAddress: "55 Trinity Avenue Southwest, Atlanta, GA 30303",
		officialSourceNote: "Google Civic returned structured polling and early-vote logistics for this address.",
		pollingLocations: [
			{
				address: "55 Trinity Ave SW, Atlanta, GA 30303",
				id: "polling-1",
				name: "Atlanta City Hall Atrium",
				note: "7:00 AM - 7:00 PM",
			},
		],
	},
	location: {
		coverageLabel: "Civic results available",
		displayName: "Provo, Utah",
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: false,
		slug: "provo-utah",
		state: "Utah"
	},
	lookupQuery: "84604",
	note: "ZIP code 84604 appears to be in Provo, Utah. Ballot Clarity matched this location and loaded the civic results available for this area.",
	normalizedAddress: "84604",
	representativeMatches: [
		{
			districtLabel: "Congressional District 3",
			id: "ocd-person:test-ut-rep",
			name: "Mike Kennedy",
			officeTitle: "Representative",
			party: "Republican",
			sourceSystem: "Open States"
		}
	],
	result: "resolved"
};

const ipGuessedPublishedGuideResponse: LocationLookupResponse = {
	...nationwideResponse,
	detectedFromIp: true,
	electionSlug: "2026-fulton-county-general",
	guideContent: stagedGuideContent,
	guideAvailability: "published",
	location: {
		coverageLabel: "Live local guide area: Fulton County, Georgia",
		displayName: "Fulton County, Georgia",
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: true,
		slug: "fulton-county-georgia",
		state: "Georgia"
	},
	note: "Ballot Clarity made a best-effort location guess from your IP address and started with ZIP code 30303 near Atlanta, GA."
};

const manualPublishedGuideResponse: LocationLookupResponse = {
	...ipGuessedPublishedGuideResponse,
	detectedFromIp: false
};

const ambiguousZipResponse: LocationLookupResponse = {
	...nationwideResponse,
	location: undefined,
	lookupQuery: "84001",
	note: "ZIP code 84001 matched 2 possible civic areas in the current provider data. Choose the correct area below so Ballot Clarity can load the right districts, representatives, and any published guide coverage for this ZIP.",
	representativeMatches: undefined,
	selectionOptions: [
		{
			description: "Matched district: Congressional District 3. 1 representative match will load for this area. No published local guide is available for this area yet.",
			guideAvailability: "not-published",
			id: "zip:84001:provo-utah",
			label: "Provo, Utah"
		},
		{
			description: "Matched district: Congressional District 4. 1 representative match will load for this area. No published local guide is available for this area yet.",
			guideAvailability: "not-published",
			id: "zip:84001:orem-utah",
			label: "Orem, Utah"
		}
	]
};

test("successful nationwide lookup builds a persisted nationwide result context", () => {
	const update = deriveCivicLookupStateUpdate(nationwideResponse, activeElection);

	assert.deepEqual(update.lookupContext, {
		guideAvailability: "not-published",
		hasPublishedGuideShell: false,
		hasVerifiedContestPackage: false,
		result: "resolved"
	});
	assert.equal(update.selectedLocation, null);
	assert.equal(update.nationwideLookupResult?.location?.displayName, "Provo, Utah");
	assert.equal(update.nationwideLookupResult?.election?.slug, activeElection.slug);
	assert.equal(update.nationwideLookupResult?.actions.length, 1);
	assert.equal(update.nationwideLookupResult?.electionLogistics?.pollingLocations[0]?.name, "Atlanta City Hall Atrium");
});

test("non-published-guide lookups keep a persisted app context instead of dropping back to null state", () => {
	const update = deriveCivicLookupStateUpdate(nationwideResponse, activeElection);

	assert.equal(update.selectedLocation, null);
	assert.ok(update.nationwideLookupResult);
	assert.equal(update.nationwideLookupResult?.normalizedAddress, "84604");
	assert.deepEqual(update.lookupContext, {
		guideAvailability: "not-published",
		hasPublishedGuideShell: false,
		hasVerifiedContestPackage: false,
		result: "resolved"
	});
});

test("ip-guessed guide availability stays in nationwide context until the user confirms a guide location", () => {
	const update = deriveCivicLookupStateUpdate(ipGuessedPublishedGuideResponse, activeElection);

	assert.equal(update.selectedLocation, null);
	assert.equal(update.nationwideLookupResult?.detectedFromIp, true);
	assert.equal(update.nationwideLookupResult?.guideAvailability, "published");
	assert.equal(update.nationwideLookupResult?.guideContent?.publishedGuideShell, true);
});

test("manual address or ZIP lookup overrides guessed context by activating the published guide location", () => {
	const update = deriveCivicLookupStateUpdate(manualPublishedGuideResponse, activeElection);

	assert.equal(update.nationwideLookupResult, null);
	assert.equal(update.selectedLocation?.displayName, "Fulton County, Georgia");
	assert.equal(update.selectedLocation?.slug, "fulton-county-georgia");
});

test("ambiguous ZIP lookups keep their selection options in persisted nationwide context", () => {
	const update = deriveCivicLookupStateUpdate(ambiguousZipResponse, activeElection);

	assert.equal(update.selectedLocation, null);
	assert.equal(update.nationwideLookupResult?.selectionOptions.length, 2);
	assert.equal(update.nationwideLookupResult?.lookupQuery, "84001");
});

test("nationwide lookups route into the results experience", () => {
	assert.equal(resolveLookupDestination(nationwideResponse), "/results?lookup=84604");
});

test("homepage entry state stops promoting the featured guide preview when a nationwide context is active", () => {
	assert.deepEqual(buildHomeExperienceState(true, false, false), {
		primaryLookupPath: "/results",
		showFeaturedGuidePreview: false,
		showPublishedElectionOverview: false,
		showNationwideResults: true,
		startHerePrimaryLabel: "Open results",
		startHerePrimaryPath: "/results"
	});
});

test("homepage entry state stays lookup-first when no nationwide or published guide context is active", () => {
	assert.deepEqual(buildHomeExperienceState(false, false, false), {
		primaryLookupPath: "/#location-lookup",
		showFeaturedGuidePreview: false,
		showPublishedElectionOverview: false,
		showNationwideResults: false,
		startHerePrimaryLabel: "Open location lookup",
		startHerePrimaryPath: "/#location-lookup"
	});
});

test("homepage entry state only promotes the ballot guide when a verified guide context is active", () => {
	assert.deepEqual(buildHomeExperienceState(false, true, true), {
		primaryLookupPath: "/ballot",
		showFeaturedGuidePreview: true,
		showPublishedElectionOverview: false,
		showNationwideResults: false,
		startHerePrimaryLabel: "Open ballot guide",
		startHerePrimaryPath: "/ballot"
	});
});

test("homepage entry state promotes the election overview when only the guide shell is active", () => {
	assert.deepEqual(buildHomeExperienceState(false, true, false), {
		primaryLookupPath: "/elections",
		showFeaturedGuidePreview: false,
		showPublishedElectionOverview: true,
		showNationwideResults: false,
		startHerePrimaryLabel: "Open election overview",
		startHerePrimaryPath: "/elections"
	});
});
