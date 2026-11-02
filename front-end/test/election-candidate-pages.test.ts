import type { StateRecordsResponse } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { loadElectionCandidatePages } from "../src/utils/election-candidate-pages.ts";

function page(offset: number): StateRecordsResponse {
	return { available: true, source: { stateCode: "GA", stateName: "Georgia", configured: true, id: "fixture" }, total: 108, matched: 108, inactive: 0, offset, limit: 100, records: Array.from({ length: offset ? 8 : 100 }, (_, index) => ({ id: String(offset + index), name: "Synthetic Candidate", office: "Governor", district: "", scope: "statewide", status: "write-in" })) };
}

test("supplemented elections retain every office anchor by joining bounded consistent pages", async () => {
	const calls: number[] = [];
	const result = await loadElectionCandidatePages(async (offset) => {
		calls.push(offset);
		return page(offset);
	}, true);
	assert.deepEqual(calls, [0, 100]);
	assert.equal(result.records.length, 108);
	assert.equal(result.limit, 108);
	assert.equal((await loadElectionCandidatePages(async offset => page(offset), false, 100)).records.length, 8);
});

test("changed, duplicated or empty later pages fail rather than showing a mixed election", async () => {
	for (const change of [(value: StateRecordsResponse) => ({ ...value, matched: 109 }), (value: StateRecordsResponse) => ({ ...value, offset: 0 }), (value: StateRecordsResponse) => ({ ...value, records: [] }), (value: StateRecordsResponse) => ({ ...value, records: value.records.map(record => ({ ...record, id: "1" })) })]) await assert.rejects(loadElectionCandidatePages(async offset => offset ? change(page(offset)) : page(offset), true));
	let calls = 0;
	await loadElectionCandidatePages(async (offset) => {
		calls += 1;
		return { ...page(offset), matched: 1001 };
	}, true);
	assert.equal(calls, 1);
});
