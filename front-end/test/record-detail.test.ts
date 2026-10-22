import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { findRecordDetail } from "../src/utils/record-detail.ts";

test("record details advance through pages and select an exact identity", async () => {
	const offsets: number[] = [];
	const result = await findRecordDetail(async (offset) => {
		offsets.push(offset);
		return { available: true, matched: 3, offset, records: [{ id: String(offset) }] };
	}, record => record.id === "2");
	assert.deepEqual(offsets, [0, 1, 2]);
	assert.equal(result?.record.id, "2");
});

test("missing, empty and unavailable records never substitute a similar person", async () => {
	for (const available of [true, false]) {
		assert.equal(await findRecordDetail(async () => ({ available, matched: 1, offset: 0, records: [{ id: "different-person" }] }), record => record.id === "requested-person"), null);
	}
	assert.equal(await findRecordDetail(async () => ({ available: true, matched: 10, offset: 0, records: [] }), () => true), null);
});

test("record detail rejects stuck pagination and preserves transport failure", async () => {
	await assert.rejects(findRecordDetail(async () => ({ available: true, matched: 100, offset: 0, records: [{ id: "other" }] }), () => false), /did not advance/u);
	await assert.rejects(findRecordDetail(async () => {
		throw new Error("Unavailable provider");
	}, () => false), /Unavailable provider/u);
});

test("directory rows have one detail link and keep secondary content on the detail page", () => {
	const component = readFileSync(new URL("../src/components/ElectionReferences.vue", import.meta.url), "utf8");
	assert.doesNotMatch(component, /record.facts|record.source.publisher|record.source.capturedAt/u);
	assert.match(component, /kind: 'reference', name: record.name, source: record.source.collectionId/u);
	const detail = readFileSync(new URL("../src/pages/record/[state]/[id].vue", import.meta.url), "utf8");
	assert.match(detail, /record.id === recordId.value && \(!sourceId.value \|\| record.source.collectionId === sourceId.value\)/u);
	assert.match(detail, /status: "all"/u);
	assert.match(detail, /data.official.ballotDesignation/u);
	assert.match(detail, /Reporting does not establish ballot qualification/u);
});
