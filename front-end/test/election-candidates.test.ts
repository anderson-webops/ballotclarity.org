import type { PublicStateCandidateRecord } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { groupElectionCandidates } from "../src/utils/election-candidates.ts";
import { readRecoverableStateRecordQuery } from "../src/utils/state-record-query.ts";

test("election candidates retain every sourced person in federal, state and local office groups", () => {
	const records: PublicStateCandidateRecord[] = [
		{ id: "federal-one", name: "First Federal", office: "United States Senate", scope: "statewide", district: "", status: "listed", party: "Republican" },
		{ id: "federal-two", name: "Second Federal", office: "United States Senate", scope: "statewide", district: "", status: "listed", party: "Democratic" },
		{ id: "state", name: "State Person", office: "State Senate", scope: "state-senate", district: "48", status: "listed" },
		{ id: "local", name: "Local Person", office: "County Commissioner", scope: "local", district: "5", status: "write-in" }
	];
	const before = structuredClone(records);
	const groups = groupElectionCandidates(records);
	assert.deepEqual(groups.map(group => group.label), ["Federal", "State", "Local"]);
	assert.equal(groups[0]!.offices[0]!.candidates.length, 2);
	assert.equal(groups[1]!.offices[0]!.title, "State Senate, District 48");
	assert.deepEqual(groups.flatMap(group => group.offices.flatMap(office => office.candidates)), records);
	assert.deepEqual(records, before);
});

test("known state records load automatically while explicit selections and invalid inputs retain precedence", () => {
	const states = [{ stateCode: "GA", stateName: "Georgia", configured: true }, { stateCode: "WA", stateName: "Washington", configured: true }];
	assert.equal(readRecoverableStateRecordQuery({}, states, "Georgia").stateCode, "GA");
	assert.equal(readRecoverableStateRecordQuery({ state: "WA" }, states, "GA").stateCode, "WA");
	assert.equal(readRecoverableStateRecordQuery({ state: "" }, states, "GA").stateCode, "");
	assert.equal(readRecoverableStateRecordQuery({ state: "invalid" }, states, "GA").stateCode, "");
	assert.equal(readRecoverableStateRecordQuery({}, states).stateCode, "");
});

test("overview and location watchers only track loaded data, not their own store writes", () => {
	const overview = readFileSync(new URL("../src/pages/elections/[slug].vue", import.meta.url), "utf8");
	const location = readFileSync(new URL("../src/pages/locations/[slug].vue", import.meta.url), "utf8");
	assert.match(overview, /watch\(data,/u);
	assert.match(location, /watch\(\[jurisdiction, nextElectionData\]/u);
	assert.doesNotMatch(overview + location, /watchEffect\(/u);
	assert.match(overview, /<ElectionCandidateRecords/u);
	for (const token of ["lg:col-start-2", "lg:row-span-2", "lg:row-start-1"])
		assert(overview.includes(token));
	assert.match(overview, /<ElectionKeyDates[^>]* compact/u);
	assert.doesNotMatch(overview, /Open location hub|pastKeyDates|changeLog/u);
});

test("compact deadlines retain the election's calendar date and consequential voting-time notes", () => {
	const dates = readFileSync(new URL("../src/components/ElectionKeyDates.vue", import.meta.url), "utf8");
	assert.match(dates, /props.electionDate && item.label === "Election Day polls close"/u);
	assert.match(dates, /:datetime="compactDate\(item\)"/u);
	assert.match(dates, /v-if="compactNote\(item\)"/u);
	assert.match(dates, /v-if="item.isNext"/u);
});
