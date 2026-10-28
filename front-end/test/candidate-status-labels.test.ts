import type { PublicStateCandidateRecord } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stateRecordStatusBadges } from "../src/utils/state-records.ts";

const candidate: PublicStateCandidateRecord = { id: "example", name: "Example", office: "United States Senate", district: "", scope: "statewide", status: "listed" };

test("candidacy labels distinguish incumbent candidates without treating missing incumbency as a verified challenger", () => {
	assert.deepEqual(stateRecordStatusBadges(candidate), []);
	assert.deepEqual(stateRecordStatusBadges(candidate, true), ["Candidate"]);
	assert.deepEqual(stateRecordStatusBadges({ ...candidate, incumbent: true }), ["Incumbent"]);
	assert.deepEqual(stateRecordStatusBadges({ ...candidate, incumbent: true }, true), ["Incumbent candidate"]);
	assert.deepEqual(stateRecordStatusBadges({ ...candidate, status: "write-in" }, true), ["Candidate", "Write-in"]);
	assert.deepEqual(stateRecordStatusBadges({ ...candidate, status: "unopposed", incumbent: true }, true), ["Incumbent candidate", "Unopposed"]);
	assert.deepEqual(stateRecordStatusBadges({ ...candidate, status: "filed" }, true), ["Candidate", "Filed"]);
	for (const status of ["listed", "filed", "qualified", "write-in", "unopposed", "withdrawn", "disqualified", "defeated", "elected", "inactive", "unrecognized"] as const) {
		const labels = stateRecordStatusBadges({ ...candidate, status, incumbent: true }, true);
		assert(labels.length <= 2);
		assert(!labels.includes("Challenger"));
		assert(!labels.includes("Not up for election"));
	}
});

test("election rows show their source-supported labels and a specific district applicability note", () => {
	const overview = readFileSync(new URL("../src/components/ElectionCandidateRecords.vue", import.meta.url), "utf8");
	assert.match(overview, /Races vary by voting district/u);
	assert.match(overview, /stateRecordStatusBadges\(candidate\)/u);
	assert.doesNotMatch(overview, /Not a personalized ballot|data\.source\.scopeNotice|<details/u);
	const profile = readFileSync(new URL("../src/pages/record/[state]/[id].vue", import.meta.url), "utf8");
	assert.match(profile, /stateRecordStatusBadges\(data\.official, true\)/u);
	assert.doesNotMatch(profile, /Candidate records|data\.source\.documentLinks|data\.source\.scopeNotice/u);
	const sources = readFileSync(new URL("../src/pages/record-sources.vue", import.meta.url), "utf8");
	for (const label of ["Sample ballot", "District 5 write-ins", "Public Service Commission"]) assert(sources.includes(label));
});
