import assert from "node:assert/strict";
import test from "node:test";
import { buildLookupActionDestination, buildLookupPresentation, filterLookupActionsForPresentation, hasPublishedGuideResult } from "../src/utils/location-lookup.ts";

const choiceLocation = { coverageLabel: "Statewide questions", displayName: "Georgia", slug: "georgia", state: "Georgia" };
const choiceLayer = { count: 1, detail: "", hasContent: true, label: "", status: "verified_local" as const };
const choiceContent = { candidates: choiceLayer, contests: choiceLayer, guideShell: choiceLayer, mixedContent: false, measures: choiceLayer, officialLogistics: choiceLayer, publishedGuideShell: true, summary: "", verifiedContestPackage: true };
const unselectedResult = { guideAvailability: "not-published" as const, result: "resolved" as const };
const choiceAction = { description: "Statewide questions", electionSlug: "ga-general", guideContent: choiceContent, id: "ga-guide", kind: "ballot-guide" as const, location: choiceLocation, title: "Georgia" };

test("competing published guides remain visible without a selected guide", () => {
	assert.deepEqual(filterLookupActionsForPresentation([choiceAction], unselectedResult), [choiceAction]);
});

test("same-title guides for different elections are not collapsed", () => {
	const other = { ...choiceAction, electionSlug: "ga-special", id: "ga-special-guide" };
	assert.equal(filterLookupActionsForPresentation([choiceAction, other, choiceAction], unselectedResult).length, 2);
});

test("unpublished actions and unresolved geographic choices cannot expose a guide", () => {
	assert.equal(filterLookupActionsForPresentation([{ ...choiceAction, guideContent: { ...choiceContent, publishedGuideShell: false } }], unselectedResult).length, 0);
	assert.equal(filterLookupActionsForPresentation([choiceAction], { ...unselectedResult, result: "unsupported" }).length, 0);
	assert.equal(filterLookupActionsForPresentation([choiceAction], { ...unselectedResult, selectionOptions: [{ description: "", guideAvailability: "not-published", id: "area", label: "Area" }] }).length, 0);
});

test("each published action chooses its own ballot or logistics surface", () => {
	assert.equal(buildLookupActionDestination(choiceAction, unselectedResult), "/ballot/ga-general?location=georgia");
	assert.equal(buildLookupActionDestination({ ...choiceAction, guideContent: { ...choiceContent, verifiedContestPackage: false } }, { ...unselectedResult, electionSlug: choiceAction.electionSlug, guideAvailability: "published", guideContent: choiceContent, location: choiceLocation }), "/elections/ga-general");
});

test("legacy action context is inherited only from the exact selected guide", () => {
	const legacy = { ...choiceAction, guideContent: undefined };
	const selected = { ...unselectedResult, electionSlug: choiceAction.electionSlug, guideAvailability: "published" as const, guideContent: choiceContent, location: choiceLocation };
	assert.equal(buildLookupActionDestination(legacy, selected), "/ballot/ga-general?location=georgia");
	assert.equal(buildLookupActionDestination({ ...legacy, electionSlug: "other-election" }, selected), null);
	assert.equal(buildLookupActionDestination({ ...legacy, location: { ...choiceLocation, slug: "other-area" } }, selected), null);
	assert.equal(buildLookupActionDestination({ ...legacy, guideContent: null }, selected), null);
});

test("incomplete or external actions never become internal guide links", () => {
	assert.equal(buildLookupActionDestination({ ...choiceAction, location: undefined }, unselectedResult), null);
	assert.equal(buildLookupActionDestination({ ...choiceAction, electionSlug: undefined }, unselectedResult), null);
	assert.equal(buildLookupActionDestination({ ...choiceAction, kind: "official-verification", url: "https://www.eac.gov/" }, unselectedResult), null);
});

test("duplicate official tools still retain the first named link", () => {
	const official = { description: "", id: "official", kind: "official-verification" as const, title: "Official tool", url: "https://www.eac.gov/" };
	assert.deepEqual(filterLookupActionsForPresentation([official, { ...official, id: "duplicate", title: " OFFICIAL TOOL " }], unselectedResult), [official]);
});

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
		availabilityBadgeLabel: "Civic results available",
		canOpenGuide: false,
		footerNote: "",
		guideActionLabel: "Open results",
		heading: "Civic results ready",
		supportingNote: ""
	});
});

test("location lookup only exposes guide navigation when published guide coverage exists", () => {
	const response = {
		electionSlug: "2026-fulton-county-general",
		guideContent: {
			candidates: { count: 5, detail: "Candidate records still rely on unverified review material instead of verified local content.", hasContent: true, label: "Candidates", status: "staged_reference" as const },
			contests: { count: 4, detail: "Contest records still rely on unverified review material instead of verified local content.", hasContent: true, label: "Contests", status: "staged_reference" as const },
			guideShell: { count: 1, detail: "This local guide is published with verified official election links, but the contest pages still need local review.", hasContent: true, label: "Local guide", status: "official_logistics_only" as const },
			mixedContent: true,
			measures: { count: 2, detail: "Measure records still rely on unverified review material instead of verified local content.", hasContent: true, label: "Measures", status: "staged_reference" as const },
			officialLogistics: { count: 3, detail: "Official county and statewide election logistics are attached from current official sources.", hasContent: true, label: "Official logistics", status: "verified_local" as const },
			publishedGuideShell: true,
			summary: "This published local guide includes verified official election links, but some contest, candidate, or measure pages are still under local review.",
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
	assert.equal(buildLookupPresentation(response).heading, "Results");
	assert.equal(buildLookupPresentation(response).availabilityBadgeLabel, "Election information available");
	assert.equal(buildLookupPresentation(response).guideActionLabel, "Election information");
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
		footerNote: "Choose one of the matched ZIP areas here to load the right districts, officials, and official election links.",
		guideActionLabel: "Choose this area",
		heading: "Choose the matched ZIP area",
		supportingNote: "This ZIP matched more than one civic area. Choose the right area to continue."
	});
});
