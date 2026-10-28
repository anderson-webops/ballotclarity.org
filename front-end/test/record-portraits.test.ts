import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (name: string) => readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");

test("candidate summaries and source records render available portraits without extra client requests", () => {
	for (const name of ["components/ElectionCandidateRecords.vue", "components/CandidateCard.vue", "components/ElectionReferences.vue", "pages/records.vue", "pages/record/[state]/[id].vue"]) {
		const page = source(name);
		assert.match(page, /<ProfileImageStack/u, name);
		assert.match(page, /profileImages/u, name);
		assert.doesNotMatch(page, /api\([^\n]*(?:portrait|image)/iu, name);
	}
});

test("the candidate directory is reachable from Search rather than individual record headers", () => {
	const detail = source("pages/record/[state]/[id].vue");
	assert.doesNotMatch(detail, /Candidate records|backTo/u);
	assert.match(detail, /image\.attribution/u);
	assert.match(source("pages/search.vue"), /to="\/records"[^>]*>\s*Candidate records list/u);
});
