import type { LocationLookupResponse } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { buildActiveLookupSummary } from "../src/utils/active-lookup.ts";
import { normalizeLookupResponseForDisplay } from "../src/utils/nationwide-results.ts";

const provoLookupResponse: LocationLookupResponse = {
	actions: [],
	availability: null,
	districtMatches: [],
	guideAvailability: "not-published",
	inputKind: "zip",
	location: {
		coverageLabel: "Civic results available",
		displayName: "Provo, Utah",
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: false,
		slug: "provo-utah",
		state: "Utah"
	},
	lookupQuery: "84604",
	note: "Lookup results for Provo, Utah.",
	representativeMatches: [],
	result: "resolved"
};

const oremLookupResponse: LocationLookupResponse = {
	...provoLookupResponse,
	location: {
		coverageLabel: "Civic results available",
		displayName: "Orem, Utah",
		lookupMode: "zip-preview",
		requiresOfficialConfirmation: false,
		slug: "orem-utah",
		state: "Utah"
	},
	lookupQuery: "84057",
	note: "Lookup results for Orem, Utah."
};

test("active lookup summary follows the latest successful lookup context used by districts and results", () => {
	const firstLookupContext = normalizeLookupResponseForDisplay(provoLookupResponse, null);
	const secondLookupContext = normalizeLookupResponseForDisplay(oremLookupResponse, null);

	assert.equal(buildActiveLookupSummary({
		nationwideLookupResult: firstLookupContext,
		selectedLocation: null
	}).label, "Provo, Utah");

	const latestLookupSummary = buildActiveLookupSummary({
		nationwideLookupResult: secondLookupContext,
		selectedLocation: null
	});

	assert.equal(latestLookupSummary.label, "Orem, Utah");
	assert.equal(latestLookupSummary.mode, "nationwide");
	assert.notEqual(latestLookupSummary.resolvedAt, "");
});
