import type { StateRecordsResponse } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ballotSourceNotes } from "../src/utils/ballot-notices.ts";
import { isSampleBallotDocument, recordPublicationGroups, recordPublications, recordSourceNotice, recordSourceTitle } from "../src/utils/record-publications.ts";

const source: StateRecordsResponse["source"] = {
	stateCode: "GA",
	stateName: "Georgia",
	configured: true,
	id: "ga-fulton-2026",
	label: "Fulton County general-election publications",
	scopeNotice: "Fulton County publications only; state and federal write-in names are not included.",
	documentLinks: [
		{ label: "Fulton consolidated sample ballot", url: "https://fultoncountyga.gov/elections/Sample-Ballot--Consolidated.pdf" },
		{ label: "County Commission District 5 qualified write-ins", url: "https://fultoncountyga.gov/elections/write-ins.pdf" },
		{ label: "Public Service Commission election scope", url: "https://sos.ga.gov/elections/psc" },
	],
};
const read = (filename: string) => readFileSync(new URL(`../src/${filename}`, import.meta.url), "utf8");

test("official ballot calls to action use existing safe documents without inventing availability", () => {
	assert.equal(recordPublications(source).find(isSampleBallotDocument)?.url, source.documentLinks![0]!.url);
	assert.equal(recordPublications({ ...source, documentLinks: source.documentLinks!.slice(1) }).find(isSampleBallotDocument), undefined);
	assert.deepEqual(recordPublications({ ...source, documentLinks: [{ label: "Sample ballot", url: "javascript:alert(1)" }] }), []);
	assert.deepEqual(recordPublications(), []);
	const button = read("components/OfficialSampleBallot.vue");
	assert.match(button, /v-if="target"/u);
	assert.match(button, /Official Sample Ballot/u);
	assert.match(button, /:new-tab="false"/u);
	assert.doesNotMatch(button, /No sample|not available|does not exist/iu);
	const candidates = read("components/ElectionCandidateRecords.vue");
	assert.match(candidates, /v-if="sampleBallot \|\| pending/u);
	assert.doesNotMatch(candidates, /No candidate records are available yet/u);
});

test("source sections reflect known document scope without duplicating the sample ballot", () => {
	const groups = recordPublicationGroups(source);
	assert.deepEqual(groups.map(group => group.label), ["State", "Local"]);
	assert.deepEqual(groups.flatMap(group => group.documents).map(document => document.label), ["Public Service Commission", "District 5 write-ins"]);
	assert(groups.every(group => !group.documents.some(isSampleBallotDocument)));
	assert.equal(recordSourceTitle(source), "Fulton County election sources");
	assert.equal(recordSourceNotice(source), "");
	assert.equal(recordSourceNotice({ ...source, id: "another-source", scopeNotice: "Filing does not establish ballot qualification." }), "Filing does not establish ballot qualification.");
});

test("the specifically removed Fulton caveat is not reintroduced by ballot previews", () => {
	const preview = { id: "ga-fulton-2026", disclaimer: source.scopeNotice! };
	assert.deepEqual(ballotSourceNotes([preview as Parameters<typeof ballotSourceNotes>[0][number]]), []);
	assert.equal(preview.disclaimer, source.scopeNotice);
});

test("collection timestamps move to the footer while operational dates remain available", () => {
	const updated = read("components/UpdatedAt.vue");
	assert.match(updated, /useMounted\(\)/u);
	assert.match(updated, /<Teleport v-if="footer && mounted" to="#page-data-updated"/u);
	assert.match(updated, /<time :datetime="value">/u);
	assert.match(updated, /v-else-if="!footer"/u);
	const footer = read("components/AppFooter.vue");
	assert.match(footer, /id="page-data-updated" class="text-right"/u);
	for (const filename of ["pages/record-sources.vue", "pages/record/[state]/[id].vue", "pages/ballot-record/[source]/[id].vue", "components/BallotContentPreviews.vue"])
		assert.doesNotMatch(read(filename), /Retrieved\s*\{\{/u);
	assert.match(read("pages/privacy.vue"), /<UpdatedAt label="Effective"/u);
	assert.match(read("pages/admin/index.vue"), /label="Last run"/u);
});

test("the source page consolidates its heading, groups publications and keeps only footer directory navigation", () => {
	const page = read("pages/record-sources.vue");
	assert.match(page, /justify-between/u);
	assert.match(page, /<OfficialSampleBallot v-if="sampleBallot"/u);
	assert.match(page, /v-for="group in groups"/u);
	assert.doesNotMatch(page, /Candidate records list|recordsTarget|No source documents|<dt>Retrieved/u);
	assert.match(read("components/AppFooter.vue"), /label: "Directory", to: "\/search\?type=candidate"/u);
	for (const filename of ["pages/search.vue", "pages/coverage.vue", "pages/sources/index.vue"])
		assert.doesNotMatch(read(filename), /to="\/records"/u);
});
