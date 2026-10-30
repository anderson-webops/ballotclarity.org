import type { BallotContentPreview, NationwideLookupResultContext } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { needsBallotPreviewRefresh, restoreMatchingBallotPreviews } from "../src/utils/ballot-preview-refresh.ts";
import { buildBallotCandidateTarget, buildElectionView, civicLookupNeedsRefresh, electionHasPassed, findBallotCandidate } from "../src/utils/ballot-view.ts";

const before = new Date("2026-10-24T12:00:00Z");
const after = new Date("2026-11-05T12:00:00Z");
const candidate = { id: "candidate-1", name: "Synthetic Candidate", party: "Example", ballotStatus: "filed" as const, candidateUrl: "https://campaign.example.org/" };
const preview: BallotContentPreview = { id: "wa-general-2026", providerId: "official-state-wa", providerLabel: "Controlled fixture", sourceAuthority: "official-government", officialOnly: true, generatedAt: "2026-10-24T12:00:00Z", electionDate: "2026-11-03", candidateCount: 1, contestCount: 1, measureCount: 0, status: "official_source_unverified", disclaimer: "Filing is not qualification.", contests: [{ id: "office-1", title: "Example office", sourceLabels: ["Controlled fixture"], candidates: [candidate] }] };
const context = { result: "resolved", inputKind: "zip", lookupQuery: "98101", location: { state: "WA", slug: "seattle" }, districtMatches: [], representativeMatches: [], selectionOptions: [], actions: [], availability: null, election: null, electionLogistics: null, resolvedAt: before.toISOString(), ballotContentPreviews: [preview] } as unknown as NationwideLookupResultContext;

test("ballot cards use a source-bound dedicated record instead of making the name a campaign link", () => {
	assert.deepEqual(buildBallotCandidateTarget(preview, candidate), { path: "/record/WA/candidate-1", query: { source: "wa-general-2026", name: "Synthetic Candidate" } });
});

test("other providers receive dedicated pages with ZIP-only lookup context and no raw address", () => {
	const other = { ...preview, id: "provider-election", providerId: "provider" };
	assert.deepEqual(buildBallotCandidateTarget(other, candidate, { lookupQuery: "98101", selectionId: "zip:98101:seattle" }), { path: "/ballot-record/provider-election/candidate-1", query: { lookup: "98101", selection: "zip:98101:seattle" } });
	assert.deepEqual(buildBallotCandidateTarget(other, candidate, { lookupQuery: "123 Main St, Seattle WA" })?.query, {});
	assert.equal(buildBallotCandidateTarget({ ...other, id: ".." }, candidate), null);
	assert.equal(buildBallotCandidateTarget(other, { ...candidate, id: "../other" }), null);
});

test("person pages resolve exact source and candidate IDs and refuse ambiguous or name-only matches", () => {
	assert.equal(findBallotCandidate(context, preview.id, candidate.id)?.candidate, candidate);
	assert.equal(findBallotCandidate(context, "different-source", candidate.id), null);
	assert.equal(findBallotCandidate(context, preview.id, "Synthetic Candidate"), null);
	const duplicate = { ...preview, contests: [...preview.contests, { ...preview.contests[0]!, id: "office-2" }] };
	assert.equal(findBallotCandidate({ ballotContentPreviews: [duplicate] }, preview.id, candidate.id), null);
});

test("election day remains visible through the last possible local calendar day", () => {
	assert.equal(electionHasPassed("2026-11-03", new Date("2026-11-04T11:59:59Z")), false);
	assert.equal(electionHasPassed("2026-11-03", new Date("2026-11-04T12:00:00Z")), true);
	assert.equal(electionHasPassed("2026-02-30", after), false);
	assert.equal(electionHasPassed("not-a-date", after), false);
});

test("the election view separates past records and does not conjecture another roster", () => {
	assert.deepEqual(buildElectionView(context, before).previews, [preview]);
	const past = buildElectionView(context, after);
	assert.equal(past.betweenElections, true);
	assert.deepEqual(past.previews, []);
	assert.deepEqual(past.pastPreviews, [preview]);
	const unknown = buildElectionView({ election: null, electionLogistics: null, ballotContentPreviews: [] }, after);
	assert.equal(unknown.betweenElections, false);
	assert.deepEqual(unknown.previews, []);
});

test("a newly published later election replaces the old ballot rather than borrowing its candidates", () => {
	const future = { ...preview, id: "fixture-2028", electionDate: "2028-11-07", contests: [{ ...preview.contests[0]!, candidates: [{ ...candidate, id: "future-person", name: "Future Synthetic Candidate" }] }] };
	const view = buildElectionView({ ...context, ballotContentPreviews: [preview, future] }, after);
	assert.equal(view.betweenElections, true);
	assert.deepEqual(view.previews, [future]);
	assert.equal(view.previews[0]!.contests[0]!.candidates[0]!.name, "Future Synthetic Candidate");
	assert.equal(buildElectionView({ ...context, electionLogistics: { electionDay: "2026-11-17" } as NationwideLookupResultContext["electionLogistics"] }, after).betweenElections, false);
});

test("configured source dates provide a cycle after temporary candidate data expires", () => {
	const empty = { election: null, electionLogistics: null, ballotContentPreviews: [] };
	assert.equal(buildElectionView(empty, before, ["2026-11-03"]).betweenElections, false);
	assert.equal(buildElectionView(empty, after, ["2026-11-03"]).betweenElections, true);
	assert.equal(buildElectionView(empty, after, ["2026-11-03", "2027-11-02"]).betweenElections, true);
});

test("post-election refresh takes current representatives from the refreshed lookup, never the candidate list", () => {
	const current = { ...context, resolvedAt: after.toISOString(), ballotContentPreviews: [], representativeMatches: [{ id: "officeholder-1", name: "Synthetic Officeholder" }] } as unknown as NationwideLookupResultContext;
	assert.equal(needsBallotPreviewRefresh(context, after), true);
	const refreshed = restoreMatchingBallotPreviews(context, current, after)!;
	assert.deepEqual(refreshed.representativeMatches, current.representativeMatches);
	assert.equal(buildElectionView(refreshed, after).betweenElections, true);
	assert.deepEqual(buildElectionView(refreshed, after).previews, []);
	assert.equal(restoreMatchingBallotPreviews(context, { ...current, lookupQuery: "98102" }, after), context);
	assert.equal(restoreMatchingBallotPreviews(context, { ...current, location: { ...context.location!, slug: "different-place" } }, after), context);
});

test("freshness remains explicit for off-election representatives", () => {
	assert.equal(civicLookupNeedsRefresh(context, after), true);
	assert.equal(civicLookupNeedsRefresh({ resolvedAt: after.toISOString() }, after), false);
	assert.equal(civicLookupNeedsRefresh({}, after), true);
});

test("ballot-style rows navigate, do not cast selections, and leave long designation text on detail pages", () => {
	const component = readFileSync(new URL("../src/components/BallotContentPreviews.vue", import.meta.url), "utf8");
	const detail = readFileSync(new URL("../src/pages/ballot-record/[source]/[id].vue", import.meta.url), "utf8");
	assert.match(component, /buildBallotCandidateTarget/u);
	assert.match(component, /border border-app-line/u);
	assert.match(component, /candidate\.profileImages/u);
	assert.match(component, /candidate\.incumbent/u);
	assert.doesNotMatch(component, /type="(?:radio|checkbox)"|aria-checked|ballotDesignation|candidate\.candidateUrl|overflow-hidden/u);
	assert.match(detail, /record\.candidate\.ballotDesignation/u);
	assert.match(detail, /Candidate website/u);
});
