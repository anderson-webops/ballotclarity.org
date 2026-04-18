import type { ElectionSummary, LocationLookupResponse } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
	buildHomeExperienceState,
	deriveCivicLookupStateUpdate,
	resolveLookupDestination
} from "../src/utils/nationwide-results.ts";

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
			detail: "Finance and influence pages are only published where Ballot Clarity has source-backed local candidate records.",
			label: "Finance and influence",
			status: "unavailable"
		},
		fullLocalGuide: {
			detail: "A full local contest and measure guide is not published for this area yet.",
			label: "Full local guide",
			status: "unavailable"
		},
		nationwideCivicResults: {
			detail: "Nationwide civic results and official election tools are available for this ZIP lookup even though a published local guide is not available for this area yet.",
			label: "Nationwide civic results",
			status: "available"
		},
		representatives: {
			detail: "ZIP-only lookups do not reliably identify exact current representatives without a full street address.",
			label: "Representative data",
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
	location: {
		coverageLabel: "Nationwide civic results available",
		displayName: "Provo, Utah",
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: true,
		slug: "provo-utah",
		state: "Utah"
	},
	note: "ZIP code 84604 appears to be in Provo, Utah. Ballot Clarity matched this location and loaded the nationwide civic result layers available here.",
	normalizedAddress: "84604",
	representativeMatches: [],
	result: "resolved"
};

test("successful nationwide lookup builds a persisted nationwide result context", () => {
	const update = deriveCivicLookupStateUpdate(nationwideResponse, activeElection);

	assert.deepEqual(update.lookupContext, {
		guideAvailability: "not-published",
		result: "resolved"
	});
	assert.equal(update.selectedLocation, null);
	assert.equal(update.nationwideLookupResult?.location?.displayName, "Provo, Utah");
	assert.equal(update.nationwideLookupResult?.election?.slug, activeElection.slug);
	assert.equal(update.nationwideLookupResult?.actions.length, 1);
});

test("non-published-guide lookups keep a persisted app context instead of dropping back to null state", () => {
	const update = deriveCivicLookupStateUpdate(nationwideResponse, activeElection);

	assert.equal(update.selectedLocation, null);
	assert.ok(update.nationwideLookupResult);
	assert.equal(update.nationwideLookupResult?.normalizedAddress, "84604");
	assert.deepEqual(update.lookupContext, {
		guideAvailability: "not-published",
		result: "resolved"
	});
});

test("nationwide lookups route into the nationwide results experience", () => {
	assert.equal(resolveLookupDestination(nationwideResponse), "/results");
});

test("homepage entry state stops promoting the featured guide preview when a nationwide context is active", () => {
	assert.deepEqual(buildHomeExperienceState(true), {
		primaryLookupPath: "/results",
		showFeaturedGuidePreview: false,
		showNationwideResults: true,
		startHerePrimaryLabel: "Open nationwide results",
		startHerePrimaryPath: "/results"
	});
});
