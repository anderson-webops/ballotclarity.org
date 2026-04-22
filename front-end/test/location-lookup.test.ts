import assert from "node:assert/strict";
import test from "node:test";
import { buildLookupPresentation, filterLookupActionsForPresentation, hasPublishedGuideResult } from "../src/utils/location-lookup.ts";

test("location lookup treats nationwide-only resolved coverage as a success state", () => {
	const response = {
		electionSlug: undefined,
		guideAvailability: "not-published" as const,
		location: undefined,
		result: "resolved" as const
	};

	assert.equal(hasPublishedGuideResult(response), false);
	assert.deepEqual(filterLookupActionsForPresentation([
		{ description: "Open guide", electionSlug: "2026-fulton-county-general", id: "guide", kind: "ballot-guide", title: "Fulton County" },
		{ description: "Open official tool", id: "official", kind: "official-verification", title: "Official tool", url: "https://example.org" }
	], response).map(action => action.kind), ["official-verification"]);

	assert.deepEqual(buildLookupPresentation(response), {
		availabilityBadgeLabel: "Nationwide civic results available",
		canOpenGuide: false,
		footerNote: "This lookup succeeded nationwide. Use the district, representative, provenance, and official-tool layers here even when a full local guide is not published yet.",
		heading: "Nationwide civic results ready",
		supportingNote: "Ballot Clarity matched this lookup to nationwide civic coverage. Official tools stay visible below for ballot confirmation, voter status, and polling-place details."
	});
});

test("location lookup only exposes guide navigation when published guide coverage exists", () => {
	const response = {
		electionSlug: "2026-fulton-county-general",
		guideContent: {
			candidates: { count: 5, detail: "Candidate records still rely on staged reference-archive material instead of verified local packaging.", hasContent: true, label: "Candidates", status: "staged_reference" as const },
			contests: { count: 4, detail: "Contest records still rely on staged reference-archive material instead of verified local packaging.", hasContent: true, label: "Contests", status: "staged_reference" as const },
			guideShell: { count: 1, detail: "The local guide shell is published and official logistics are verified, but the contest package still needs verified local review.", hasContent: true, label: "Guide shell", status: "official_logistics_only" as const },
			mixedContent: true,
			measures: { count: 2, detail: "Measure records still rely on staged reference-archive material instead of verified local packaging.", hasContent: true, label: "Measures", status: "staged_reference" as const },
			officialLogistics: { count: 3, detail: "Official county and statewide election logistics are attached from current official sources.", hasContent: true, label: "Official logistics", status: "verified_local" as const },
			publishedGuideShell: true,
			summary: "This published local guide shell has verified official logistics, but contest, candidate, or measure content is still staged until local verification is complete.",
			verifiedContestPackage: false
		},
		guideAvailability: "published" as const,
		location: {
			coverageLabel: "Live local guide area: Fulton County, Georgia",
			displayName: "Fulton County, Georgia",
			slug: "fulton-county-georgia",
			state: "Georgia"
		},
		result: "resolved" as const
	};

	assert.equal(hasPublishedGuideResult(response), true);
	assert.equal(filterLookupActionsForPresentation([
		{ description: "Open guide", electionSlug: "2026-fulton-county-general", id: "guide", kind: "ballot-guide", location: response.location, title: "Fulton County" }
	], response).length, 1);
	assert.equal(buildLookupPresentation(response).canOpenGuide, true);
	assert.equal(buildLookupPresentation(response).heading, "Local guide shell and civic results ready");
	assert.equal(buildLookupPresentation(response).availabilityBadgeLabel, "Local guide shell live");
});

test("location lookup shows a chooser state when a ZIP still needs one more area selection", () => {
	const response = {
		electionSlug: undefined,
		guideAvailability: "not-published" as const,
		location: undefined,
		result: "resolved" as const,
		selectionOptions: [
			{ description: "Provo option", guideAvailability: "not-published" as const, id: "one", label: "Provo, Utah" },
			{ description: "Orem option", guideAvailability: "not-published" as const, id: "two", label: "Orem, Utah" }
		]
	};

	assert.deepEqual(buildLookupPresentation(response), {
		availabilityBadgeLabel: "ZIP area selection needed",
		canOpenGuide: false,
		footerNote: "Choose one of the matched ZIP areas here to load the right district, representative, and official-tool layers before moving deeper into the app.",
		heading: "Choose the matched ZIP area",
		supportingNote: "This ZIP resolved to multiple civic areas in the current provider data. Ballot Clarity needs one more selection before it can open a single area cleanly."
	});
});
