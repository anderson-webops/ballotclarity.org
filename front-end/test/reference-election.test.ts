import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readReferenceElection, referenceElectionControl, referenceElectionQuery } from "../src/utils/reference-election.ts";

test("explicit reference elections preserve valid dates and reject malformed requests without current fallback", () => {
	assert.equal(readReferenceElection(undefined), undefined);
	assert.equal(readReferenceElection("2026-11-03"), "2026-11-03");
	assert.equal(readReferenceElection("2026-11-03", "hi-sos-2026"), "");
	for (const value of ["", "2026-02-30", "2026-11-03T00:00:00Z", ["2026-11-03"], null, 2026]) assert.equal(readReferenceElection(value), "");
});

test("one election control keeps profile selection distinct from official source identities", () => {
	assert.equal(referenceElectionControl("hi-sos-2026", undefined), "hi-sos-2026");
	assert.equal(referenceElectionControl(undefined, "2026-11-03"), "references:2026-11-03");
	assert.deepEqual(referenceElectionQuery("references:2026-11-03"), { referenceElection: "2026-11-03" });
	assert.deepEqual(referenceElectionQuery("hi-sos-2026"), { source: "hi-sos-2026" });
	assert.deepEqual(referenceElectionQuery("../invalid-source"), { source: "../invalid-source" });
	assert.deepEqual(referenceElectionQuery(""), {});
});

test("reference detail requests bind their source and directory controls reuse available stored dates", () => {
	const detail = readFileSync(new URL("../src/pages/record/[state]/[id].vue", import.meta.url), "utf8");
	assert.match(detail, /query: \{ source: sourceId.value, q: search.value/u);
	const directory = readFileSync(new URL("../src/components/CandidateDirectory.vue", import.meta.url), "utf8");
	assert.match(directory, /<optgroup v-if="referenceDates.length" label="Profiles">/u);
	assert.match(directory, /referenceElection.value === undefined \? filters.value.stateCode : ""/u);
	assert.match(directory, /electionDate: referenceElection.value \?\? sourceElection.value/u);
	assert.match(directory, /\.\.\.referenceElectionQuery\(selectedSource.value\)/u);
	assert.doesNotMatch(directory, /watchEffect|show more|Past profiles are/u);
});
