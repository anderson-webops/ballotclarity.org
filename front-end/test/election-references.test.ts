import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readStateRecordQuery } from "../src/utils/state-records.ts";

test("candidate information keeps source attribution and dates without qualification badges", () => {
	const component = readFileSync(new URL("../src/components/ElectionReferences.vue", import.meta.url), "utf8");
	assert.match(component, /Candidate-provided/u);
	assert.match(component, /News report/u);
	assert.match(component, /Reporting does not establish ballot qualification/u);
	assert.match(component, /record.source.publisher/u);
	assert.match(component, /record.source.publishedDate/u);
	assert.match(component, /record.source.capturedAt/u);
	assert.match(component, /:href="record.source.pageUrl \?\? record.source.url"/u);
	assert.match(component, /class="attention-date"/u);
	assert.doesNotMatch(component, /v-html|Candidate website|Qualified|prototype|check back later|under local review/u);
});

test("information pagination has its own bounded offset and does not move official records", () => {
	const component = readFileSync(new URL("../src/components/ElectionReferences.vue", import.meta.url), "utf8");
	const page = readFileSync(new URL("../src/pages/records.vue", import.meta.url), "utf8");
	assert.match(page, /route.query.referenceOffset/u);
	assert.match(component, /\.\.\.route.query, referenceOffset/u);
	assert.match(component, /aria-label="Candidate information pages"/u);
	assert.equal(readStateRecordQuery({ offset: "25001" }, []).offset, 0);
	assert.equal(readStateRecordQuery({ offset: "-1" }, []).offset, 0);
	assert.equal(readStateRecordQuery({ offset: "50" }, []).offset, 50);
	const composable = readFileSync(new URL("../src/composables/useElectionReferences.ts", import.meta.url), "utf8");
	assert.match(composable, /\/election-references\//u);
	assert.doesNotMatch(composable, /\/state-records\/|status:|qualification/u);
	const official = readFileSync(new URL("../src/composables/useStateRecords.ts", import.meta.url), "utf8");
	assert.doesNotMatch(composable, /watch: \[filters\]/u);
	assert.doesNotMatch(official, /watch: \[filters\]/u);
	assert.match(composable, /JSON.stringify\(filters.value\)/u);
	assert.match(official, /JSON.stringify\(filters.value\)/u);
});

test("references render even when official candidate data is unavailable", () => {
	const page = readFileSync(new URL("../src/pages/records.vue", import.meta.url), "utf8");
	assert.match(page, /<ElectionReferences v-if="filters.stateCode"/u);
	assert.match(page, /search: filters.value.search, scope: filters.value.scope/u);
	assert.match(page, /useElectionReferences\(referenceFilters\)/u);
	assert.match(page, /href="#candidate-information-heading"/u);
	assert.match(page, /Official candidate records are unavailable/u);
	const component = readFileSync(new URL("../src/components/ElectionReferences.vue", import.meta.url), "utf8");
	assert.match(component, /\{\{ fact \}\}/u);
	assert.match(component, /aria-labelledby="candidate-information-heading"/u);
	assert.doesNotMatch(component, /ballotContentPreviews|guideAvailability|districtMatches/u);
});
