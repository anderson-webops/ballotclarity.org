import type { BallotContentPreview, GuideContentSummary } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ballotInformationDisclaimer, ballotSourceNotes, hasBallotInformation } from "../src/utils/ballot-notices.ts";
import { buildResultsSummaryItems, limitedBallotNotice } from "../src/utils/results-summary.ts";

function preview(disclaimer = "Filing does not establish ballot qualification."): BallotContentPreview {
	return { id: "wa-general-2026", providerId: "official-state-wa", providerLabel: "Washington", generatedAt: "2026-10-24T12:00:00Z", status: "official_source_unverified", sourceAuthority: "official-government", officialOnly: true, candidateCount: 1, contestCount: 1, measureCount: 0, disclaimer, contests: [{ id: "state-office", title: "State office", candidates: [{ id: "example", name: "Example candidate", ballotStatus: "filed" }] }] };
}

function guide(verifiedContestPackage = false): GuideContentSummary {
	const layer = { count: 0, detail: "", hasContent: false, label: "", status: "official_logistics_only" as const };
	return { candidates: layer, contests: layer, guideShell: { ...layer, hasContent: true }, measures: layer, officialLogistics: layer, mixedContent: false, publishedGuideShell: true, verifiedContestPackage, summary: "" };
}

test("actual official candidate records replace the limited-information message without implying verified coverage", () => {
	const record = preview();
	assert.equal(hasBallotInformation({ ballotContentPreviews: [record] }), true);
	const summary = buildResultsSummaryItems({ ballotContentPreviews: [record], districtMatches: [], guideAvailability: "not-published", representativeMatches: [] }, 1);
	assert.equal(summary.length, 3);
	assert.ok(summary.every(item => item.value !== "Verified"));
	assert.ok(!summary.some(item => item.note === limitedBallotNotice));
});

test("real measure text or choices also replace the limited-information message", () => {
	const measure = preview();
	measure.contests[0]!.candidates = [];
	measure.contests[0]!.referendum = { responses: ["Yes", "No"] };
	assert.equal(hasBallotInformation({ ballotContentPreviews: [measure] }), true);
});

test("configuration, logistics shells, stale counts and empty preview containers are not ballot content", () => {
	const empty = preview();
	empty.contests = [];
	assert.equal(hasBallotInformation(null), false);
	assert.equal(hasBallotInformation({ guideContent: guide() }), false);
	assert.equal(hasBallotInformation({ ballotContentPreviews: [empty] }), false);
	empty.contests = [{ id: "empty", title: "No content", candidates: [], referendum: { responses: [] } }];
	assert.equal(hasBallotInformation({ ballotContentPreviews: [empty] }), false);
	const summary = buildResultsSummaryItems({ districtMatches: [], guideAvailability: "published", guideContent: guide(), representativeMatches: [], ballotContentPreviews: [empty] }, 1);
	assert.equal(summary.length, 3);
	assert.ok(summary.every(item => item.label !== "Guide status"));
});

test("verified guides retain their existing coverage distinction", () => {
	assert.equal(hasBallotInformation({ guideContent: guide(true) }), true);
});

test("source notes retain filing, party preference and geographic facts while omitting repeated generic freshness copy", () => {
	const specific = "Filing does not establish ballot qualification. Party labels are preferences, not nominations. Some local jurisdiction labels are incomplete.";
	assert.deepEqual(ballotSourceNotes([preview(`State records; local contests may be missing. ${specific}`), preview(specific)]), [specific]);
	assert.deepEqual(ballotSourceNotes([preview("Dated snapshot; later changes and local contests may be missing. Local coverage: Pulaski County.")]), ["Local coverage: Pulaski County."]);
	assert.deepEqual(ballotSourceNotes([preview("Federal candidates only; state and local contests are not included. This is not an address-specific ballot.")]), ["Federal candidates only; state and local contests are not included. This is not an address-specific ballot."]);
	assert.deepEqual(ballotSourceNotes([preview("Dated snapshot; later changes and local contests may be missing.")]), []);
});

test("unknown provider-specific caveats remain visible and unchanged", () => {
	assert.deepEqual(ballotSourceNotes([preview("Advisory question; this vote does not enact a law.")]), ["Advisory question; this vote does not enact a law."]);
});

test("general disclaimer appears once in the footer and source notes follow rather than precede ballot records", () => {
	assert.match(ballotInformationDisclaimer, /Not an official election website/u);
	assert.match(ballotInformationDisclaimer, /incomplete, inaccurate or out of date/u);
	assert.match(ballotInformationDisclaimer, /election office/u);
	const footer = readFileSync(new URL("../src/components/AppFooter.vue", import.meta.url), "utf8");
	const previews = readFileSync(new URL("../src/components/BallotContentPreviews.vue", import.meta.url), "utf8");
	const panel = readFileSync(new URL("../src/components/LookupResultsPanel.vue", import.meta.url), "utf8");
	assert.equal((footer.match(/\{\{ ballotInformationDisclaimer \}\}/gu) ?? []).length, 1);
	assert.ok(previews.indexOf("aria-label=\"Ballot source notes\"") > previews.indexOf("</section>"));
	assert.doesNotMatch(previews, /\{\{ preview\.disclaimer \}\}|<details|<summary/u);
	assert.match(panel, /!hasBallotInformation\(displayedLookup\)/u);
});
