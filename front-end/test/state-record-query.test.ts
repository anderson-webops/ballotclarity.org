import type { StateRecordState } from "../src/types/civic.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readRecoverableStateRecordQuery, stateRecordSourceMismatch } from "../src/utils/state-record-query.ts";
import { readStateRecordQuery } from "../src/utils/state-records.ts";

const states: StateRecordState[] = [
	{ stateCode: "NE", stateName: "Nebraska", configured: false, sources: [] },
	{ stateCode: "AL", stateName: "Alabama", configured: true, sources: [{ id: "al-sos-2026", label: "Alabama Secretary of State", electionDate: "2026-11-03" }] },
];

test("a disabled state's bookmarked source recovers without changing its other filters", () => {
	const query = { state: "Nebraska", source: "ne-sos-2026", q: "Senate", scope: "statewide", status: "all", offset: "50" };
	assert.deepEqual(readRecoverableStateRecordQuery(query, states), { ...readStateRecordQuery(query, states), sourceId: undefined });
	assert.equal(readRecoverableStateRecordQuery(query, states).stateCode, "NE");
});

test("an enabled state's explicit source remains selected", () => {
	const query = { state: "AL", source: "al-sos-2026" };
	assert.deepEqual(readRecoverableStateRecordQuery(query, states), readStateRecordQuery(query, states));
});

test("an unknown or cross-state source cannot silently select another enabled publisher", () => {
	for (const source of ["unknown-source", "ne-sos-2026"]) {
		const query = { state: "AL", source };
		assert.deepEqual(readRecoverableStateRecordQuery(query, states), readStateRecordQuery(query, states));
	}
});

test("malformed source values remain subject to API validation even in a disabled state", () => {
	for (const source of [[], { id: "ne-sos-2026" }, "bad/source", "source,other", "", "x".repeat(102)]) {
		const query = { state: "NE", source };
		assert.deepEqual(readRecoverableStateRecordQuery(query, states), readStateRecordQuery(query, states));
	}
});

test("unknown states and pending state metadata do not discard requested sources", () => {
	for (const available of [states, []]) {
		const query = { state: "unknown", source: "ne-sos-2026" };
		assert.deepEqual(readRecoverableStateRecordQuery(query, available), readStateRecordQuery(query, available));
	}
	assert.deepEqual(readRecoverableStateRecordQuery({ state: "NE", source: "ne-sos-2026" }, []), readStateRecordQuery({ state: "NE", source: "ne-sos-2026" }, []));
});

test("a state with an offered publisher does not fall back from an explicit source", () => {
	const inconsistent = [{ ...states[0]!, sources: states[1]!.sources }];
	const query = { state: "NE", source: "ne-sos-2026" };
	assert.deepEqual(readRecoverableStateRecordQuery(query, inconsistent), readStateRecordQuery(query, inconsistent));
});

test("the records page uses disabled-state recovery without adding explanatory interface copy", () => {
	const page = readFileSync(new URL("../src/pages/records.vue", import.meta.url), "utf8");
	assert.match(page, /computed\(\(\) => readRecoverableStateRecordQuery\(route.query, stateData.value\?\.states \?\? \[\],/u);
	assert.match(page, /civicStore.isHydrated \? civicStore.selectedLocation\?\.state : undefined/u);
	assert.match(page, /Official candidate records are unavailable/u);
});

test("Retry refreshes the source catalog before retrying records even with cached state metadata", () => {
	const page = readFileSync(new URL("../src/pages/records.vue", import.meta.url), "utf8");
	assert.match(page, /async function retryRecords\(\) \{\s+await refreshStates\(\);\s+await refresh\(\);\s+\}/u);
});

test("an available response cannot silently substitute another explicitly requested publisher", () => {
	const available = { available: true, source: { id: "al-sos-2026" } };
	assert.equal(stateRecordSourceMismatch("retired-source-2026", available), true);
	assert.equal(stateRecordSourceMismatch("al-sos-2026", available), false);
	assert.equal(stateRecordSourceMismatch(undefined, available), false);
	assert.equal(stateRecordSourceMismatch(["al-sos-2026"], available), true);
	assert.equal(stateRecordSourceMismatch("retired-source-2026", { available: false }), false);
	assert.equal(stateRecordSourceMismatch("retired-source-2026", { available: true }), true);
	assert.equal(stateRecordSourceMismatch("retired-source-2026", undefined), false);
});

test("a retired source exposes an explicit replacement choice even with one eligible publisher", () => {
	const page = readFileSync(new URL("../src/pages/records.vue", import.meta.url), "utf8");
	assert.match(page, /v-if="sourceOptions.length > 1 \|\| unavailableSource"/u);
	assert.match(page, /v-if="unavailableSource" :value="filters.sourceId" disabled/u);
	assert.match(page, /Unavailable source/u);
	assert.match(page, /v-if="stateError \|\| error \|\| sourceMismatch"/u);
});
