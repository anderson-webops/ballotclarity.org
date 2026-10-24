import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readStateRecordQuery, resolveStateRecordCode, stateRecordArea, stateRecordScopes, stateRecordStatusLabels } from "../src/utils/state-records.ts";

const states = [{ stateCode: "ME", stateName: "Maine", configured: true }, { stateCode: "NY", stateName: "New York", configured: true }];

test("record links preserve state context without interpreting a ZIP as eligibility", () => {
	assert.equal(resolveStateRecordCode("Maine", states), "ME");
	assert.equal(resolveStateRecordCode(" ny ", states), "NY");
	assert.equal(resolveStateRecordCode("New York", states), "NY");
	assert.equal(resolveStateRecordCode("04401", states), "");
	assert.equal(resolveStateRecordCode(["ME"], states), "");
});

test("record query defaults, scope and offsets remain bounded", () => {
	assert.deepEqual(readStateRecordQuery({ state: "Maine", scope: "local", q: "Joseph", status: "all", offset: "50" }, states), { stateCode: "ME", scope: "local", search: "Joseph", status: "all", offset: 50 });
	assert.equal(readStateRecordQuery({ scope: "ward", offset: "25001", q: ["private"] }, states).scope, "all");
	assert.equal(readStateRecordQuery({ offset: "-1" }, states).offset, 0);
	assert.equal(readStateRecordQuery({ q: "x".repeat(200) }, states).search.length, 120);
	assert.equal(stateRecordScopes.length, 6);
	assert.equal(stateRecordStatusLabels.withdrawn, "Withdrawn");
});

test("source links retain explicit selection, including invalid inputs that must fail closed at the API", () => {
	assert.equal(readStateRecordQuery({ state: "Maine", source: "example-county" }, states).sourceId, "example-county");
	assert.equal(readStateRecordQuery({ state: "Maine", source: ["example-county"] }, states).sourceId, "");
	assert.equal(readStateRecordQuery({ source: "x".repeat(200) }, states).sourceId?.length, 120);
	assert.equal(readStateRecordQuery({ state: "Maine" }, states).sourceId, undefined);
	const page = readFileSync(new URL("../src/pages/records.vue", import.meta.url), "utf8");
	assert.match(page, /v-if="sourceOptions.length > 1"/u);
	assert.match(page, /for="record-source"/u);
	assert.match(page, /selectedSource.value = "";\s+await applyFilters\(\)/u);
	assert.match(page, /source: selectedSource.value/u);
});

test("record context retains jurisdictions but omits repeated office labels", () => {
	const record = { id: "example", name: "Example", office: "CITY COUNCIL", district: "", scope: "local" as const, status: "listed" as const, jurisdiction: "Bangor" };
	assert.equal(stateRecordArea(record), "Bangor");
	assert.equal(stateRecordArea({ ...record, office: "BANGOR CITY COUNCIL" }), "");
});

test("record context retains a published district when the jurisdiction repeats the office", () => {
	const record = { id: "example", name: "Example", office: "Public Service Commissioner", district: "2", scope: "local" as const, status: "listed" as const, jurisdiction: "Public Service Commissioner" };
	assert.equal(stateRecordArea(record), "District 2");
	assert.equal(stateRecordArea({ ...record, jurisdiction: "Example County District 2" }), "Example County District 2");
	assert.equal(stateRecordArea({ ...record, district: "CHITTENDEN-9", sourceDistrictLabel: "Chittenden-9" }), "Chittenden-9");
	assert.equal(stateRecordArea({ ...record, office: "Ward 2 Member of the Council", jurisdiction: "Ward 2" }), "");
});

test("a printed district label suppresses a redundant internal matching code", () => {
	const record = { id: "example", name: "Example", office: "State Representative, Grafton District 10", district: "GRAFTON-10", scope: "state-house" as const, status: "listed" as const, sourceDistrictLabel: "Grafton District 10", sourceAreaLabel: "Bristol sample ballot" };
	assert.equal(stateRecordArea(record), "Bristol sample ballot");
	assert.equal(stateRecordArea({ ...record, sourceAreaLabel: undefined }), "");
	assert.equal(stateRecordArea({ ...record, office: "State Representative" }), "Grafton District 10");
});

test("the public directory exposes only necessary labels and source limits", () => {
	const page = readFileSync(new URL("../src/pages/records.vue", import.meta.url), "utf8");
	assert.match(page, /These records are not a personalized ballot/u);
	assert.match(page, /Include inactive records/u);
	assert.match(page, /Candidate record pages/u);
	assert.doesNotMatch(page, /attention-date|attention-relative/u);
	assert.match(page, /path: `\/record\//u);
	assert.match(page, /v-for="document in data.source.documentLinks"/u);
	assert.match(page, /:href="document.url"/u);
	assert.doesNotMatch(page, /prototype|under local review|check back later|saved guide area|<table/iu);
	const lookup = readFileSync(new URL("../src/components/LookupResultsPanel.vue", import.meta.url), "utf8");
	assert.match(lookup, /path: '\/records', query: \{ state: lookup.location.state \}/u);
});

test("source documents are listed as visible links", () => {
	const page = readFileSync(new URL("../src/pages/records.vue", import.meta.url), "utf8");
	assert.match(page, /v-if="data.source.documentLinks\?\.length" class="source-documents/u);
	assert.match(page, /v-for="document in data.source.documentLinks"/u);
	assert.doesNotMatch(page, /<details|<summary/u);
});
