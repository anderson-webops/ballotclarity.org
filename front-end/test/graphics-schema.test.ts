import type { Candidate, LocationLookupAction, LocationRepresentativeMatch } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
	buildCandidateFinanceCategoryBreakdown,
	buildCandidateTimeline,
	buildLookupProvenanceSummary
} from "../src/utils/graphics-schema.ts";

const formatDate = (value: string) => value;

function buildCandidate(): Candidate {
	return {
		comparison: {
			ballotStatus: {
				asOf: "2026-03-01",
				label: "On ballot",
				provenance: { detail: "Qualified with the county.", label: "Official", status: "verified-official" },
				sources: []
			}
		},
		freshness: { dataLastUpdatedAt: "2026-03-30" },
		funding: {
			sources: [],
			topFunders: [
				{ amount: 60_000, category: "Labor", name: "Union A" },
				{ amount: 40_000, category: "Business", name: "Company B" },
				{ amount: 10_000, category: "Labor", name: "Union C" }
			],
			totalRaised: 1_000_000
		},
		keyActions: [
			{ date: "2026-02-01", id: "older", significance: "", sources: [], summary: "", title: "Older action" },
			{ date: "2026-05-01", id: "newer", significance: "", sources: [], summary: "", title: "Newer action" }
		],
		slug: "test-candidate",
		updatedAt: "2026-03-30"
	} as unknown as Candidate;
}

test("the candidate timeline is newest first across actions and ballot status", () => {
	assert.deepEqual(buildCandidateTimeline(buildCandidate()).map(event => event.id), ["newer", "test-candidate-ballot-status", "older"]);
});

test("the finance breakdown shows money outside the top-funder sample", () => {
	const breakdown = buildCandidateFinanceCategoryBreakdown(buildCandidate(), formatDate);

	assert.deepEqual(breakdown.categories.map(category => [category.label, category.amount]), [
		["Labor", 70_000],
		["Business", 40_000],
		["Not itemized among top funders", 890_000]
	]);
	assert.match(breakdown.coverageNote, /Top funders account for 11% of total raised/);
});

test("lookup provenance cites every representative provider with the canonical Open States authority", () => {
	const representatives = [
		{ districtLabel: "District 1", id: "os-1", name: "Open States Rep", officeTitle: "Representative", openstatesUrl: "https://openstates.org/person/a/", sourceSystem: "Open States", updatedAt: "2026-03-14" },
		{ districtLabel: "District 2", id: "cg-1", name: "Congress Member", officeTitle: "U.S. Representative", sourceSystem: "Congress.gov" }
	] as unknown as LocationRepresentativeMatch[];
	const tools = [
		{ description: "", id: "tool-1", kind: "official-verification", title: "My Voter Page", url: "https://example.gov/voter" }
	] as unknown as LocationLookupAction[];
	const summary = buildLookupProvenanceSummary({
		districtMatches: [],
		fromCache: false,
		inputKind: "zip",
		officialToolActions: tools,
		representativeMatches: representatives,
		resolvedAt: "2026-10-20T15:00:00.000Z"
	});
	const representativeSources = summary.sources.filter(source => source.id.startsWith("lookup-representative-source"));

	assert.equal(representativeSources.length, 2);
	assert.deepEqual(representativeSources.map(source => [source.publisher, source.authority, source.date]), [
		["Open States", "nonprofit-provider", "2026-03-14"],
		["Congress.gov", "official-government", "2026-10-20"]
	]);
	assert.equal(summary.sources.filter(source => source.authority === "official-government" && source.title === "My Voter Page").length, 1);
});
